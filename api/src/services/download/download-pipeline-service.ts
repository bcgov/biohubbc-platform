import { ParquetWriter } from '@dsnp/parquetjs';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { FRAGMENT_SIZE_THRESHOLD } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { DownloadArtifactInfo, DownloadFeatureSummary, DownloadSource } from '../../models/download';
import { DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import {
  buildCombinedHeaders,
  CsvPropertyDefinition,
  escapeCsvField,
  flattenFeatureWithParent,
  getOutputFilename
} from '../../utils/csv-utils';
import { getLogger } from '../../utils/logger';
import { buildGeoParquetMetadata, buildParquetSchema, featureToRow } from '../../utils/parquet-utils';
import { CodeService } from '../code-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { SearchFeatureService } from '../search-feature-service';

const defaultLog = getLogger('services/download-pipeline-service');

/**
 * Lightweight reference to a file-type feature's binary attachment.
 * Collected during CSV streaming (pass 1) and used later to stream files into the archive.
 */
interface FileFeatureRef {
  /** The submission_feature_id that owns this file. */
  submissionFeatureId: number;
  /** The S3 key / path to the original uploaded file. */
  filePath: string;
}

/**
 * Background processing pipeline for downloads.
 *
 * Called exclusively by the pg-boss job handler (processDownloadJobHandler).
 * Handles fragment planning, streaming CSV/zip generation, S3 upload, and
 * status transitions during async processing.
 *
 * Request-time operations (CRUD, auth, team linking, fragment URL delivery)
 * live in DownloadService.
 *
 * @export
 * @class DownloadPipelineService
 * @extends {DBService}
 */
export class DownloadPipelineService extends DBService {
  downloadRepository: DownloadRepository;
  fragmentRepository: DownloadFragmentRepository;
  searchFeatureService: SearchFeatureService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.fragmentRepository = new DownloadFragmentRepository(connection);
    this.searchFeatureService = new SearchFeatureService(connection);
  }

  /**
   * Update download status by download ID.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadStatusEnum} status - The new status.
   * @param {object} [metadata] - Optional metadata (error).
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async updateDownloadStatus(
    downloadId: string,
    status: DownloadStatusEnum,
    metadata?: { error?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const timestamps: { started_at?: string; completed_at?: string } = {};

    if (status === DownloadStatusEnum.PROCESSING) {
      timestamps.started_at = now;
    }
    if (status === DownloadStatusEnum.READY || status === DownloadStatusEnum.FAILED) {
      timestamps.completed_at = now;
    }

    return this.downloadRepository.updateDownloadStatus(downloadId, status, { ...metadata, ...timestamps });
  }

  /**
   * Get the total estimated download size — SQL aggregate only.
   *
   * Returns SUM(data_byte_size) without materializing feature rows.
   * Branches on cart_id vs filters (same source resolution as getDownloadFeatures).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<number>} Total estimated bytes.
   * @memberof DownloadPipelineService
   */
  async estimateDownloadSize(downloadId: string): Promise<number> {
    const source = await this.downloadRepository.getDownloadSource(downloadId);

    if (source.cart_id) {
      const row = await this.downloadRepository.getDownloadTotalSizeByCartId(source.cart_id);
      return Number(row.total ?? 0);
    }

    if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );
      const row = await this.downloadRepository.getDownloadTotalSizeBySearchQuery(searchSubquery);
      return Number(row.total ?? 0);
    }

    throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
  }

  /**
   * Plan fragments for a download using cursor-based streaming.
   *
   * Opens a DECLARE CURSOR over features sorted by feature_type_name,
   * FETCHes in batches of 5000, and assigns to bins on the fly.
   * Never holds more than one batch in memory.
   *
   * Follows the streamFragmentFeaturesByType pattern (download-fragment-repository.ts:136).
   *
   * @param {string} downloadId - The download ID.
   * @param {number} totalEstimatedBytes - Total estimated size from estimateDownloadSize.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async planFragments(downloadId: string, totalEstimatedBytes: number): Promise<void> {
    const download = await this.downloadRepository.findDownloadById(downloadId);
    const fragmentThreshold = Number(download?.fragment_size_bytes ?? FRAGMENT_SIZE_THRESHOLD);
    const source = await this.downloadRepository.getDownloadSource(downloadId);

    // Open the appropriate cursor based on feature source
    let featureStream: AsyncGenerator<DownloadFeatureSummary[]>;
    if (source.cart_id) {
      featureStream = this.downloadRepository.streamDownloadFeaturesByCartId(source.cart_id);
    } else if (source.filters) {
      const subquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(source.filters, source.create_user);
      const { sql, bindings } = subquery.toSQL().toNative();
      featureStream = this.downloadRepository.streamDownloadFeaturesBySearchQuery(downloadId, sql, bindings as any[]);
    } else {
      throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
    }

    // Greedy bin packing over the cursor stream
    let fragmentIndex = 0;
    let currentBinSize = 0;
    let currentBinFeatures: number[] = [];

    const flushFragment = async () => {
      if (currentBinFeatures.length === 0) {
        return;
      }
      const fragment = await this.fragmentRepository.createDownloadFragment(
        downloadId,
        fragmentIndex,
        currentBinSize,
        currentBinFeatures.length
      );
      await this.fragmentRepository.createDownloadFragmentFeatures(fragment.download_fragment_id, currentBinFeatures);
      fragmentIndex++;
      currentBinSize = 0;
      currentBinFeatures = [];
    };

    // Cursor already ORDER BY ft.name, sf.submission_feature_id
    // — same types stay together, no JS sort needed
    for await (const batch of featureStream) {
      for (const feature of batch) {
        const featureSize = Number(feature.estimated_byte_size);

        // Oversized file: give it its own dedicated fragment
        if (featureSize > fragmentThreshold) {
          await flushFragment();
          const fragment = await this.fragmentRepository.createDownloadFragment(
            downloadId,
            fragmentIndex,
            featureSize,
            1
          );
          await this.fragmentRepository.createDownloadFragmentFeatures(fragment.download_fragment_id, [
            feature.submission_feature_id
          ]);
          fragmentIndex++;
          continue;
        }

        // Would exceed threshold? Flush current bin first
        if (currentBinSize + featureSize > fragmentThreshold && currentBinFeatures.length > 0) {
          await flushFragment();
        }

        currentBinFeatures.push(feature.submission_feature_id);
        currentBinSize += featureSize;
      }
    }

    // Flush remaining features
    await flushFragment();

    await this.downloadRepository.updateDownloadFragmentCounts(downloadId, fragmentIndex, 0);
    await this.downloadRepository.updateEstimatedTotalSize(downloadId, totalEstimatedBytes);
  }

  /**
   * Plan fragments for a download if not already planned.
   *
   * Idempotent — skips planning if fragments already exist (supports resume on retry).
   *
   * Note: These methods are orchestrated by processDownloadJobHandler with per-fragment
   * transactions so that completed fragments survive retries. Do not call directly.
   *
   * @param {string} downloadId - The download ID to plan.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async planDownloadIfNeeded(downloadId: string): Promise<void> {
    const download = await this.downloadRepository.findDownloadById(downloadId);

    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    const existingFragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);

    if (existingFragments.length > 0) {
      return;
    }

    const totalBytes = await this.estimateDownloadSize(downloadId);
    await this.planFragments(downloadId, totalBytes);
  }

  /**
   * Get fragments that still need processing (not yet READY).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>} Fragments that need processing.
   * @memberof DownloadPipelineService
   */
  async getFragmentsToProcess(downloadId: string): Promise<DownloadFragmentRecord[]> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);
    return fragments.filter((f) => f.fragment_status !== DownloadStatusEnum.READY);
  }

  /**
   * Finalize a download after all fragments are processed.
   *
   * Updates fragment counts and sets the parent download status to READY.
   *
   * @param {string} downloadId - The download ID to finalize.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async finalizeDownload(downloadId: string): Promise<void> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);

    const readyCount = fragments.filter((f) => f.fragment_status === DownloadStatusEnum.READY).length;
    await this.downloadRepository.updateDownloadFragmentCounts(downloadId, fragments.length, readyCount);

    await this.updateDownloadStatus(downloadId, DownloadStatusEnum.READY);
  }

  /**
   * Mark a fragment as processing (sets started_at timestamp).
   *
   * @param {number} fragmentId - The fragment ID.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async markFragmentProcessing(fragmentId: number): Promise<void> {
    const now = new Date().toISOString();
    await this.fragmentRepository.updateFragmentStatus(fragmentId, DownloadStatusEnum.PROCESSING, {
      started_at: now
    });
  }

  /**
   * Resolve download source and artifact info for the Parquet pipeline.
   *
   * Combines two lookups into a single call so the job handler doesn't
   * need to manage the source/artifact pair separately.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<{ source: DownloadSource; artifact: DownloadArtifactInfo }>}
   * @memberof DownloadPipelineService
   */
  async getDownloadMetadata(downloadId: string): Promise<{ source: DownloadSource; artifact: DownloadArtifactInfo }> {
    const [source, artifact] = await Promise.all([
      this.downloadRepository.getDownloadSource(downloadId),
      this.downloadRepository.getDownloadArtifact(downloadId)
    ]);

    return { source, artifact };
  }

  /**
   * Build schema lookup and list feature types for a Parquet download.
   *
   * The schema lookup maps feature type names to their property definitions.
   * The feature type list drives the per-type Parquet file generation loop.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadSource} source - The download source (cart or filters).
   * @return {Promise<{ schemaLookup: Map<string, CsvPropertyDefinition[]>; featureTypes: string[] }>}
   * @memberof DownloadPipelineService
   */
  async resolveParquetSchema(
    downloadId: string,
    source: DownloadSource
  ): Promise<{ schemaLookup: Map<string, CsvPropertyDefinition[]>; featureTypes: string[] }> {
    const schemaLookup = await this.buildSchemaLookup();

    let featureTypes: string[];

    if (source.cart_id) {
      featureTypes = await this.downloadRepository.listDownloadFeatureTypesByCartId(source.cart_id);
    } else if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );
      featureTypes = await this.downloadRepository.listDownloadFeatureTypesBySearchQuery(searchSubquery);
    } else {
      throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
    }

    return { schemaLookup, featureTypes };
  }

  /**
   * Stream a single feature type to a Parquet file on S3.
   *
   * Each feature type gets its own Parquet file with a schema derived from
   * feature_type_property definitions. The star-schema design keeps files
   * independent — parent data lives in its own file, joined by parent_uuid.
   *
   * Pipeline: cursor → hydrateFeatureBatchFromTypedTables → featureToRow → writer.appendRow → S3
   *
   * Code and taxon properties arrive pre-resolved from the cursor JOIN:
   * code → contributor_codeset_code.label, taxon → taxon.itis_scientific_name.
   * Parquet files are standalone — GIS consumers have no database access.
   *
   * Zero disk usage: @dsnp/parquetjs streams to a PassThrough piped to S3 multipart upload.
   * Prevents pod OOM kills and ephemeral storage exhaustion.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadSource} source - The download source (cart or filters).
   * @param {DownloadArtifactInfo} artifact - The artifact info (S3 key prefix).
   * @param {CsvPropertyDefinition[]} properties - Schema property definitions for this feature type.
   * @param {string} featureTypeName - The feature type to stream.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async writeFeatureTypeParquet(
    downloadId: string,
    source: DownloadSource,
    artifact: DownloadArtifactInfo,
    properties: CsvPropertyDefinition[],
    featureTypeName: string
  ): Promise<void> {
    const hasSpatial = properties.some((p) => p.feature_property_type_name === 'spatial');
    const schema = buildParquetSchema(properties, hasSpatial);
    const s3Key = `${artifact.object_key}/${featureTypeName}/data.parquet`;

    // Create streaming pipeline: Parquet writer → passThrough → S3 multipart upload
    const passThrough = new PassThrough();
    const objectStorageService = new ObjectStorageService();
    const uploadPromise = objectStorageService.uploadStream(
      BucketType.MAIN,
      passThrough,
      'application/octet-stream',
      s3Key
    );

    // Open Parquet writer with optional GeoParquet metadata for spatial types
    const writerOptions: any = {};
    if (hasSpatial) {
      writerOptions.metadata = { geo: buildGeoParquetMetadata() };
    }
    // PassThrough implements write()/end() but @dsnp/parquetjs types expect fs.WriteStream.
    // The runtime only calls write() and end() — safe to cast.
    const writer = await ParquetWriter.openStream(schema, passThrough as any, writerOptions);

    // Open cursor for the appropriate source (cart or search filters)
    let cursor: AsyncGenerator<any[]>;
    if (source.cart_id) {
      cursor = this.downloadRepository.streamFeatureBaseByCartIdAndType(source.cart_id, featureTypeName);
    } else if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );
      const { sql, bindings } = searchSubquery.toSQL().toNative();
      cursor = this.downloadRepository.streamFeatureBaseBySearchQueryAndType(
        downloadId,
        sql,
        bindings as any[],
        featureTypeName
      );
    } else {
      throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
    }

    // Stream: cursor → hydrate typed properties → convert to Parquet row → write
    for await (const baseBatch of cursor) {
      const hydrated = await this.downloadRepository.hydrateFeatureBatchFromTypedTables(baseBatch, properties);
      for (const feature of hydrated) {
        await writer.appendRow(featureToRow(feature, properties));
      }
    }

    await writer.close();
    await uploadPromise;
  }

  /**
   * Finalize a Parquet download after all feature types are written.
   *
   * Updates the linked artifact to 'uploaded' (file is now on S3) and
   * sets the download status to 'ready' (available for consumer retrieval).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async finalizeParquetDownload(downloadId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.downloadRepository.updateArtifactStatusByDownloadId(downloadId, 'uploaded', now);
    await this.updateDownloadStatus(downloadId, DownloadStatusEnum.READY);
  }

  /**
   * Process a single fragment: collect features, create streaming zip, upload to S3.
   *
   * On error, marks the fragment as failed and re-throws for pg-boss retry.
   *
   * Important: Each call should run in its own committed transaction so that completed
   * fragments are not lost on retry. See processDownloadJobHandler for orchestration.
   *
   * @param {DownloadFragmentRecord} fragment - The fragment to process.
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async processFragment(fragment: DownloadFragmentRecord, downloadId: string): Promise<void> {
    const fragmentId = fragment.download_fragment_id;

    try {
      // Determine file naming: single fragment vs multi fragment
      const download = await this.downloadRepository.findDownloadById(downloadId);
      if (!download) {
        throw new Error(`Download ${downloadId} not found`);
      }
      const isSingleFragment = download.total_fragments === 1;
      const zipFileName = isSingleFragment
        ? `biohub-${downloadId}.zip`
        : `biohub-${downloadId}-part-${fragment.fragment_index + 1}.zip`;
      const s3Key = `downloads/${downloadId}/${zipFileName}`;

      // Create streaming pipeline: archiver → passThrough → S3 upload
      const objectStorageService = new ObjectStorageService();
      const passThrough = new PassThrough();
      const archive = archiver('zip', { zlib: { level: 5 } });

      let totalBytes = 0;
      archive.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
      });

      archive.on('error', (err) => {
        passThrough.destroy(err);
      });

      archive.pipe(passThrough);

      const uploadPromise = objectStorageService.uploadStream(BucketType.MAIN, passThrough, 'application/zip', s3Key);

      // Root folder inside the zip so extraction creates a containing directory
      // e.g. "biohub-abc123/" or "biohub-abc123-part-1/"
      const rootFolder = zipFileName.replace('.zip', '') + '/';

      // Index files folder for multi-fragment downloads so extracted parts combine cleanly
      const filesFolderName = isSingleFragment ? 'files' : `files${fragment.fragment_index + 1}`;

      // Stream features via cursor, append each type's CSV as it completes
      const fileRefs = await this.streamFeaturesIntoArchive(
        fragmentId,
        archive,
        `${rootFolder}${filesFolderName}`,
        rootFolder
      );

      // Stream binary files into archive
      await this.streamFilesToArchive(archive, fileRefs, objectStorageService, `${rootFolder}${filesFolderName}`);

      await archive.finalize();
      await uploadPromise;

      const now = new Date().toISOString();
      await this.fragmentRepository.updateFragmentStatus(fragmentId, DownloadStatusEnum.READY, {
        s3_key: s3Key,
        file_name: zipFileName,
        file_size_bytes: totalBytes,
        completed_at: now
      });
    } catch (error) {
      const now = new Date().toISOString();
      await this.fragmentRepository.updateFragmentStatus(fragmentId, DownloadStatusEnum.FAILED, {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: now
      });
      throw error;
    }
  }

  /**
   * Stream features into the archive using a single-pass approach driven by schema.
   *
   * Headers come from `feature_type_property` (via CodeService), so no discovery pass is needed.
   * One cursor pass per feature type writes CSV rows directly into the archive.
   *
   * @param {number} fragmentId - The fragment ID.
   * @param {archiver.Archiver} archive - The zip archive to append CSVs to.
   * @return {Promise<FileFeatureRef[]>} References to features with associated binary files.
   */
  private async streamFeaturesIntoArchive(
    fragmentId: number,
    archive: archiver.Archiver,
    filesFolderName: string,
    rootFolder: string
  ): Promise<FileFeatureRef[]> {
    const featureTypes = await this.fragmentRepository.getFragmentFeatureTypes(fragmentId);

    if (featureTypes.length === 0) {
      throw new Error(`No features found for fragment ${fragmentId}`);
    }

    // Load root dataset info once for the entire fragment (1-2 submissions per fragment)
    const rootDatasetCache = await this.fragmentRepository.getRootDatasetsByFragment(fragmentId);

    // Load schema once for all feature types
    const schemaLookup = await this.buildSchemaLookup();

    const fileRefs: FileFeatureRef[] = [];

    for (const featureType of featureTypes) {
      const refs = await this.streamFeatureTypeCsv(
        fragmentId,
        featureType,
        archive,
        schemaLookup,
        rootDatasetCache,
        filesFolderName,
        rootFolder
      );
      fileRefs.push(...refs);
    }

    return fileRefs;
  }

  /**
   * Build a lookup map from feature type name to property definitions.
   */
  private async buildSchemaLookup(): Promise<Map<string, CsvPropertyDefinition[]>> {
    const codeService = new CodeService(this.connection);
    const allFeatureTypeCodes = await codeService.getFeatureTypePropertyCodes();

    const lookup = new Map<string, CsvPropertyDefinition[]>();
    for (const ftCode of allFeatureTypeCodes) {
      lookup.set(
        ftCode.feature_type.name,
        ftCode.properties.map((p) => ({
          feature_property_name: p.name,
          feature_property_type_name: p.type_name
        }))
      );
    }
    return lookup;
  }

  /**
   * Stream a single feature type's data as a CSV into the archive.
   *
   * Returns file references for any artifact_key properties encountered.
   *
   * @param fragmentId - The download fragment to stream features from.
   * @param featureType - The feature type name (e.g. 'dataset', 'observation').
   * @param archive - The archiver instance to append the CSV stream to.
   * @param schemaLookup - Map of feature type names to their property definitions.
   * @param rootDatasetCache - Map of submission IDs to their root dataset info (uuid, name).
   * @param filesFolderName - Folder name within the archive for file artifacts.
   */
  private async streamFeatureTypeCsv(
    fragmentId: number,
    featureType: string,
    archive: archiver.Archiver,
    schemaLookup: Map<string, CsvPropertyDefinition[]>,
    rootDatasetCache: Map<number, { dataset_uuid: string; dataset_name: string | null }>,
    filesFolderName: string,
    rootFolder: string
  ): Promise<FileFeatureRef[]> {
    const isCore = featureType === 'dataset';
    const systemHeaders = isCore ? ['uuid'] : ['uuid', 'dataset_name', 'dataset_uuid'];
    const childProperties = schemaLookup.get(featureType) ?? [];

    const csvStream = new PassThrough();
    archive.append(csvStream, { name: `${rootFolder}${getOutputFilename(featureType)}` });

    let headersWritten = false;
    let parentProperties: CsvPropertyDefinition[] | null = null;
    let headers: string[] = [];
    const fileRefs: FileFeatureRef[] = [];

    for await (const batch of this.fragmentRepository.streamFragmentFeaturesByType(fragmentId, featureType)) {
      for (const feature of batch) {
        if (!headersWritten) {
          parentProperties = this.resolveParentProperties(feature.parent_feature_type_name, schemaLookup);
          headers = buildCombinedHeaders(parentProperties, childProperties, systemHeaders);
          csvStream.write(headers.map(escapeCsvField).join(',') + '\n');
          headersWritten = true;
        }

        const flattened = flattenFeatureWithParent(
          feature.data as Record<string, unknown>,
          childProperties,
          (feature.parent_data as Record<string, unknown>) ?? null,
          parentProperties,
          feature.submission_feature_id,
          filesFolderName
        );

        flattened['uuid'] = feature.uuid;
        if (!isCore) {
          const rootDataset = rootDatasetCache.get(feature.submission_id);
          flattened['dataset_name'] = rootDataset?.dataset_name ?? '';
          flattened['dataset_uuid'] = rootDataset?.dataset_uuid ?? '';
        }

        csvStream.write(headers.map((h) => escapeCsvField(flattened[h] ?? '')).join(',') + '\n');

        this.collectFileRefs(feature, childProperties, fileRefs);
      }
    }

    if (!headersWritten) {
      headers = buildCombinedHeaders(null, childProperties, systemHeaders);
      csvStream.write(headers.map(escapeCsvField).join(',') + '\n');
    }

    csvStream.end();
    return fileRefs;
  }

  /**
   * Resolve parent property definitions from the schema lookup.
   */
  private resolveParentProperties(
    parentTypeName: string | null | undefined,
    schemaLookup: Map<string, CsvPropertyDefinition[]>
  ): CsvPropertyDefinition[] | null {
    if (!parentTypeName) {
      return null;
    }
    return schemaLookup.get(parentTypeName) ?? null;
  }

  /**
   * Collect file references from artifact_key typed properties on a feature.
   */
  private collectFileRefs(
    feature: { submission_feature_id: number; data: Record<string, unknown> },
    childProperties: CsvPropertyDefinition[],
    fileRefs: FileFeatureRef[]
  ): void {
    for (const prop of childProperties) {
      if (prop.feature_property_type_name !== 'artifact_key') {
        continue;
      }
      const rawValue = (feature.data[prop.feature_property_name] ?? feature.data['file']) as string | undefined;
      if (rawValue) {
        fileRefs.push({ submissionFeatureId: feature.submission_feature_id, filePath: rawValue });
      }
    }
  }

  /**
   * Stream binary files into the archive's files/ folder.
   *
   * On failure, appends an error placeholder instead of the file.
   *
   * @param {archiver.Archiver} archive - The zip archive to append to.
   * @param {FileFeatureRef[]} fileRefs - Lightweight references to features with files.
   * @param {ObjectStorageService} objectStorageService - S3 service instance.
   * @return {Promise<void>}
   */
  private async streamFilesToArchive(
    archive: archiver.Archiver,
    fileRefs: FileFeatureRef[],
    objectStorageService: ObjectStorageService,
    filesFolderName: string
  ): Promise<void> {
    for (const ref of fileRefs) {
      const fileName = ref.filePath.split('/').pop() || 'file';
      const outputPath = `${filesFolderName}/${ref.submissionFeatureId}_${fileName}`;

      const entryProcessed = new Promise<void>((resolve, reject) => {
        const onEntry = () => {
          archive.removeListener('error', onError);
          resolve();
        };
        const onError = (err: Error) => {
          archive.removeListener('entry', onEntry);
          reject(err);
        };
        archive.once('entry', onEntry);
        archive.once('error', onError);
      });

      try {
        const fileStream = await objectStorageService.getFileStream(BucketType.MAIN, ref.filePath);
        archive.append(fileStream, { name: outputPath });
      } catch (error) {
        defaultLog.warn({
          label: 'processFragment',
          message: 'Failed to stream file, adding error placeholder',
          filePath: ref.filePath,
          error
        });
        archive.append(`Error: Could not retrieve file from ${ref.filePath}`, { name: `${outputPath}.error.txt` });
      }

      // Wait for the file to be processed and appended to the archive.
      // Keep process memory bound by handling one file stream a time
      await entryProcessed;
    }
  }
}
