import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { FRAGMENT_SIZE_THRESHOLD } from '../constants/download';
import { IDBConnection } from '../database/db';
import { DownloadFeatureSummary, DownloadId, DownloadRecord } from '../models/download';
import { DownloadFragmentRecord } from '../models/download-fragment';
import { DownloadStatusEnum } from '../models/download-status';
import { DownloadFragmentRepository } from '../repositories/download-fragment-repository';
import { DownloadRepository } from '../repositories/download-repository';
import {
  buildCombinedHeaders,
  CsvPropertyDefinition,
  escapeCsvField,
  flattenFeatureWithParent,
  getOutputFilename
} from '../utils/csv-utils';
import { getLogger } from '../utils/logger';
import { CodeService } from './code-service';
import { DBService } from './db-service';
import { BucketType, ObjectStorageService } from './object-storage/object-storage-service';

const defaultLog = getLogger('services/download-service');

export { FRAGMENT_SIZE_THRESHOLD } from '../constants/download';
export const SIGNED_URL_EXPIRY_FRAGMENT = 3600; // 1 hour for fragment URLs

/**
 * Result of estimating a download's total size before processing.
 * Used by planFragments to decide how to split features across zip files.
 *
 * Per-feature and total sizes are computed inline in the SQL query.
 */
interface DownloadSizeEstimate {
  /** Total estimated bytes across all features. */
  totalEstimatedBytes: number;
  /** The features included in this download with per-feature estimated_byte_size. */
  features: DownloadFeatureSummary[];
}

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
 * Service for download pipeline operations.
 *
 * @export
 * @class DownloadService
 * @extends {DBService}
 */
export class DownloadService extends DBService {
  downloadRepository: DownloadRepository;
  fragmentRepository: DownloadFragmentRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.fragmentRepository = new DownloadFragmentRepository(connection);
  }

  /**
   * Create a new download request.
   *
   * Creates a download record and links the specified submission features.
   * Caller must validate that submissionFeatureIds is non-empty.
   *
   * @param {number} systemUserId - The user initiating the download.
   * @param {number[]} submissionFeatureIds - The submission feature IDs to include.
   * @param {number} [fragmentSizeMb] - Target fragment size in MB (500, 1000, or 5000). Defaults to 500.
   * @return {Promise<DownloadId>} The created download record ID.
   * @memberof DownloadService
   */
  async createDownloadRequest(
    systemUserId: number,
    submissionFeatureIds: number[],
    fragmentSizeMb?: number
  ): Promise<DownloadId> {
    const fragmentSizeBytes = fragmentSizeMb ? fragmentSizeMb * 1024 * 1024 : undefined;

    const downloadId = await this.downloadRepository.createDownload(systemUserId, fragmentSizeBytes);

    await this.downloadRepository.createDownloadFeatures(downloadId.download_id, submissionFeatureIds);

    return downloadId;
  }

  /**
   * Get a download record by ID.
   *
   * @param {number} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadService
   */
  async findDownloadById(downloadId: number): Promise<DownloadRecord | null> {
    return this.downloadRepository.findDownloadById(downloadId);
  }

  /**
   * Get all download records for a user.
   *
   * @param {number} systemUserId - The user ID.
   * @return {Promise<DownloadRecord[]>}
   * @memberof DownloadService
   */
  async getDownloadsByUserId(systemUserId: number): Promise<DownloadRecord[]> {
    return this.downloadRepository.getDownloadsByUserId(systemUserId);
  }

  /**
   * Update download status by download ID.
   *
   * @param {number} downloadId - The download ID.
   * @param {DownloadStatusEnum} status - The new status.
   * @param {object} [metadata] - Optional metadata (s3_key, file_name, file_size_bytes, error).
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async updateDownloadStatus(
    downloadId: number,
    status: DownloadStatusEnum,
    metadata?: { s3_key?: string; file_name?: string; file_size_bytes?: string | number; error?: string }
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
   * Get lightweight summaries for all authorized features in a download.
   *
   * @param {number} downloadId - The download ID.
   * @param {number} systemUserId - The user requesting the download.
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadService
   */
  async getDownloadFeatureSummaries(downloadId: number, systemUserId: number): Promise<DownloadFeatureSummary[]> {
    return this.downloadRepository.getDownloadFeatureSummaries(downloadId, systemUserId);
  }

  /**
   * Get all fragments for a download.
   *
   * @param {number} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>}
   * @memberof DownloadService
   */
  async getFragmentsByDownloadId(downloadId: number): Promise<DownloadFragmentRecord[]> {
    return this.fragmentRepository.getFragmentsByDownloadId(downloadId);
  }

  /**
   * Estimate the total download size and plan fragmentation.
   *
   * Uses pre-computed data_byte_size which includes JSONB size + CSV overhead + artifact file size.
   *
   * @param {number} downloadId - The download ID.
   * @param {number} systemUserId - The user requesting the download.
   * @return {Promise<DownloadSizeEstimate>}
   * @memberof DownloadService
   */
  async estimateDownloadSize(downloadId: number, systemUserId: number): Promise<DownloadSizeEstimate> {
    const features = await this.getDownloadFeatureSummaries(downloadId, systemUserId);
    const totalEstimatedBytes = features.reduce((sum, f) => sum + Number(f.estimated_byte_size), 0);

    return { totalEstimatedBytes, features };
  }

  /**
   * Plan fragments for a download based on size estimation.
   *
   * Uses greedy bin packing driven by the download record's `fragment_size_bytes`.
   * When total bytes fit within one bin, a single fragment is naturally created.
   * Oversized files get their own dedicated fragment.
   *
   * @param {number} downloadId - The download ID.
   * @param {DownloadSizeEstimate} sizeEstimate - The size estimation result.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async planFragments(downloadId: number, sizeEstimate: DownloadSizeEstimate): Promise<void> {
    const features = sizeEstimate.features;

    // Read configurable fragment size from the download record
    const download = await this.downloadRepository.findDownloadById(downloadId);
    const fragmentThreshold = Number(download?.fragment_size_bytes ?? FRAGMENT_SIZE_THRESHOLD);

    // Greedy bin packing using fragment_size_bytes as the bin capacity
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

    for (const feature of features) {
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

    // Flush remaining features
    await flushFragment();

    await this.downloadRepository.updateDownloadFragmentCounts(downloadId, fragmentIndex, 0);

    await this.downloadRepository.updateEstimatedTotalSize(downloadId, sizeEstimate.totalEstimatedBytes);
  }

  /**
   * Plan fragments for a download if not already planned.
   *
   * Idempotent — skips planning if fragments already exist (supports resume on retry).
   *
   * Note: These methods are orchestrated by processDownloadJobHandler with per-fragment
   * transactions so that completed fragments survive retries. Do not call directly.
   *
   * @param {number} downloadId - The download ID to plan.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async planDownloadIfNeeded(downloadId: number): Promise<void> {
    const download = await this.downloadRepository.findDownloadById(downloadId);

    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    const existingFragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);

    if (existingFragments.length > 0) {
      return;
    }

    const sizeEstimate = await this.estimateDownloadSize(downloadId, download.system_user_id);
    await this.planFragments(downloadId, sizeEstimate);
  }

  /**
   * Get fragments that still need processing (not yet READY).
   *
   * @param {number} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>} Fragments that need processing.
   * @memberof DownloadService
   */
  async getFragmentsToProcess(downloadId: number): Promise<DownloadFragmentRecord[]> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);
    return fragments.filter((f) => f.fragment_status !== DownloadStatusEnum.READY);
  }

  /**
   * Finalize a download after all fragments are processed.
   *
   * Updates fragment counts and sets the parent download status to READY.
   *
   * @param {number} downloadId - The download ID to finalize.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async finalizeDownload(downloadId: number): Promise<void> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);

    const readyCount = fragments.filter((f) => f.fragment_status === DownloadStatusEnum.READY).length;
    await this.downloadRepository.updateDownloadFragmentCounts(downloadId, fragments.length, readyCount);

    const totalSizeBytes = fragments.reduce((sum, f) => sum + Number(f.file_size_bytes ?? 0), 0);

    if (fragments.length === 1) {
      const singleFragment = fragments[0];
      await this.updateDownloadStatus(downloadId, DownloadStatusEnum.READY, {
        s3_key: singleFragment.s3_key ?? undefined,
        file_name: singleFragment.file_name ?? undefined,
        file_size_bytes: singleFragment.file_size_bytes ?? undefined
      });
    } else {
      await this.updateDownloadStatus(downloadId, DownloadStatusEnum.READY, {
        file_size_bytes: totalSizeBytes
      });
    }
  }

  async markFragmentProcessing(fragmentId: number): Promise<void> {
    const now = new Date().toISOString();
    await this.fragmentRepository.updateFragmentStatus(fragmentId, DownloadStatusEnum.PROCESSING, {
      started_at: now
    });
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
   * @param {number} downloadId - The parent download ID.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async processFragment(fragment: DownloadFragmentRecord, downloadId: number): Promise<void> {
    const fragmentId = fragment.download_fragment_id;

    try {
      // Determine file naming: single fragment vs multi fragment
      const download = await this.downloadRepository.findDownloadById(downloadId);
      if (!download) {
        throw new Error(`Download ${downloadId} not found`);
      }
      const isSingleFragment = download.total_fragments === 1;
      const zipFileName = isSingleFragment
        ? `download-${downloadId}.zip`
        : `download-${downloadId}-part-${fragment.fragment_index + 1}.zip`;
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

      // Index files folder for multi-fragment downloads so extracted parts combine cleanly
      const filesFolderName = isSingleFragment ? 'files' : `files${fragment.fragment_index + 1}`;

      // Stream features via cursor, append each type's CSV as it completes
      const fileRefs = await this.streamFeaturesIntoArchive(fragmentId, archive, filesFolderName);

      // Stream binary files into archive
      await this.streamFilesToArchive(archive, fileRefs, objectStorageService, filesFolderName);

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
    filesFolderName: string
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
        filesFolderName
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
        ftCode.feature_type.feature_type_name,
        ftCode.feature_type_properties.map((p) => ({
          feature_property_name: p.feature_property_name,
          feature_property_type_name: p.feature_property_type_name
        }))
      );
    }
    return lookup;
  }

  /**
   * Stream a single feature type's data as a CSV into the archive.
   *
   * Returns file references for any artifact_key properties encountered.
   */
  private async streamFeatureTypeCsv(
    fragmentId: number,
    featureType: string,
    archive: archiver.Archiver,
    schemaLookup: Map<string, CsvPropertyDefinition[]>,
    rootDatasetCache: Map<number, { dataset_uuid: string; dataset_name: string | null }>,
    filesFolderName: string
  ): Promise<FileFeatureRef[]> {
    const isCore = featureType === 'dataset';
    const systemHeaders = isCore ? ['uuid'] : ['uuid', 'dataset_name', 'dataset_uuid'];
    const childProperties = schemaLookup.get(featureType) ?? [];

    const csvStream = new PassThrough();
    archive.append(csvStream, { name: getOutputFilename(featureType) });

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

      const entryProcessed = new Promise<void>((resolve) => archive.once('entry', () => resolve()));

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

  /**
   * Get a signed URL for downloading a specific fragment.
   *
   * Validates the fragment exists and is ready before generating the URL.
   *
   * @param {number} downloadId - The download ID.
   * @param {number} fragmentIndex - The zero-based fragment index.
   * @return {Promise<string>} The signed download URL.
   * @memberof DownloadService
   */
  async getFragmentSignedUrl(downloadId: number, fragmentIndex: number): Promise<string> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);
    const fragment = fragments.find((f) => f.fragment_index === fragmentIndex);

    if (!fragment) {
      throw new Error(`Fragment ${fragmentIndex} not found for download ${downloadId}`);
    }

    if (fragment.fragment_status !== DownloadStatusEnum.READY) {
      throw new Error('Fragment is not ready');
    }

    if (!fragment.s3_key) {
      throw new Error('Fragment record missing s3_key');
    }

    const objectStorageService = new ObjectStorageService();
    return objectStorageService.getSignedUrl(BucketType.MAIN, fragment.s3_key, SIGNED_URL_EXPIRY_FRAGMENT);
  }
}
