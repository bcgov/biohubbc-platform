import { Feature, Geometry } from 'geojson';
import { z } from 'zod';
import { IDBConnection } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { FeatureTypePropertyMetadata } from '../../models/submission-feature-property-index';
import { SubmissionFeaturePropertyIndexRepository } from '../../repositories/submission-feature-property-index-repository';
import {
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionRepository
} from '../../repositories/submission-repository';
import { TaxonomyRepository } from '../../repositories/taxonomy-repository';
import { normalizeArtifactReference } from '../../utils/artifact-reference-utils';
import { CodeReference, parseCodeReference } from '../../utils/code-reference';
import { getLogger } from '../../utils/logger';
import { splitTimestampValue } from '../../utils/timestamp-utils';
import {
  GeoJSONGeometryCollectionZodSchema,
  GeoJSONLineStringZodSchema,
  GeoJSONMultiLineStringZodSchema,
  GeoJSONMultiPointZodSchema,
  GeoJSONMultiPolygonZodSchema,
  GeoJSONPointZodSchema,
  GeoJSONPolygonZodSchema
} from '../../zod-schema/geoJsonZodSchema';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import {
  PendingArtifactRecord,
  PendingCodeRecord,
  PendingTaxonRecord,
  PropertyRecordBuckets
} from '../search-feature-service.interface';
import { SubmissionFeaturePropertyIndexService } from '../submission-feature-property-index-service';

const defaultLog = getLogger('services/ingestion/submission-feature-property-ingestion-service');
const INDEX_BATCH_SIZE = 10000;

const GeoJSONGeometryZodSchema = z.union([
  GeoJSONPointZodSchema,
  GeoJSONLineStringZodSchema,
  GeoJSONPolygonZodSchema,
  GeoJSONMultiPointZodSchema,
  GeoJSONMultiLineStringZodSchema,
  GeoJSONMultiPolygonZodSchema,
  GeoJSONGeometryCollectionZodSchema
]);

const GeoJSONFeatureWithGeometryZodSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeoJSONGeometryZodSchema,
  properties: z.unknown().optional(),
  id: z.union([z.number(), z.string()]).optional()
});

const GeoJSONFeatureCollectionWithGeometryZodSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureWithGeometryZodSchema)
});

type RelationshipCandidate = {
  source_feature_id: number;
  referenceSourceId: string;
};

type ParentCandidate = {
  child_submission_feature_id: number;
  parentSourceId: string;
};

type FeatureBatchLinkBuckets = {
  relationshipSourceIds: Set<string>;
  relationshipCandidates: RelationshipCandidate[];
  parentSourceIds: Set<string>;
  parentCandidates: ParentCandidate[];
};

/**
 * Service for deep submission feature property indexing and validation.
 */
export class SubmissionFeaturePropertyIngestionService extends DBService {
  /**
   * Initializes the SubmissionFeaturePropertyIngestionService with a database connection.
   *
   * @param {IDBConnection} connection
   */
  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Indexes feature properties into canonical typed submission_feature_property_* tables.
   *
   * Uses server-side cursor batches to keep memory bounded for large uploads.
   *
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   */
  async indexSubmissionPropertiesBySubmissionUploadId(submissionId: number, submissionUploadId: string): Promise<void> {
    defaultLog.debug({
      label: 'indexSubmissionPropertiesBySubmissionUploadId',
      message: 'start',
      submissionId,
      submissionUploadId
    });

    const submissionFeaturePropertyIndexService = new SubmissionFeaturePropertyIndexService(this.connection);
    const submissionFeaturePropertyIndexRepository = new SubmissionFeaturePropertyIndexRepository(this.connection);
    const submissionRepository = new SubmissionRepository(this.connection);
    const contributorService = new ContributorService(this.connection);

    await submissionFeaturePropertyIndexService.deletePropertyRecordsBySubmissionUploadId(submissionUploadId);
    await submissionRepository.clearSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId);
    await submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(submissionUploadId);

    const contributor = await contributorService.getContributorBySubmissionId(submissionId);
    const metadataByFeatureType = new Map<number, Map<string, FeatureTypePropertyMetadata>>();
    const loadedFeatureTypeIds = new Set<number>();

    const featureBatches = await submissionFeaturePropertyIndexRepository.streamSubmissionFeaturesBySubmissionUploadId(
      submissionUploadId,
      INDEX_BATCH_SIZE
    );

    for await (const featureBatch of featureBatches) {
      await this.indexSubmissionFeaturePropertyBatch(
        submissionId,
        contributor.contributor_id,
        submissionUploadId,
        featureBatch,
        metadataByFeatureType,
        loadedFeatureTypeIds,
        submissionFeaturePropertyIndexService,
        submissionRepository
      );
    }
  }

  /**
   * Process one submission_feature batch for canonical property indexing.
   *
   * @private
   */
  private async indexSubmissionFeaturePropertyBatch(
    submissionId: number,
    contributorId: number,
    submissionUploadId: string,
    featureBatch: SubmissionFeatureRecordWithTypeAndSecurity[],
    metadataByFeatureType: Map<number, Map<string, FeatureTypePropertyMetadata>>,
    loadedFeatureTypeIds: Set<number>,
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService,
    submissionRepository: SubmissionRepository
  ): Promise<void> {
    if (!featureBatch.length) {
      return;
    }

    await this.loadMissingFeatureTypeMetadata(
      featureBatch,
      loadedFeatureTypeIds,
      metadataByFeatureType,
      submissionFeaturePropertyIndexService
    );

    const propertyRecordBuckets = this.createPropertyRecordBuckets();
    const featureBatchLinkBuckets = this.createFeatureBatchLinkBuckets();

    this.extractPropertyAndLinkRecordsFromFeatureBatch(
      submissionId,
      featureBatch,
      metadataByFeatureType,
      propertyRecordBuckets,
      featureBatchLinkBuckets
    );

    await this.resolveCodeProperties(
      submissionId,
      contributorId,
      submissionFeaturePropertyIndexService,
      propertyRecordBuckets.pendingCodeRecords,
      propertyRecordBuckets.codeRecords
    );
    await this.resolveTaxonProperties(
      submissionId,
      propertyRecordBuckets.pendingTaxonRecords,
      propertyRecordBuckets.taxonRecords
    );
    await this.resolveArtifactProperties(
      submissionId,
      submissionUploadId,
      submissionFeaturePropertyIndexService,
      propertyRecordBuckets.pendingArtifactRecords,
      propertyRecordBuckets.artifactRecords
    );

    await this.persistPropertyRecords(submissionFeaturePropertyIndexService, propertyRecordBuckets);
    await this.resolveFeatureLinksForBatch(
      submissionId,
      submissionUploadId,
      featureBatchLinkBuckets,
      submissionRepository
    );
  }

  /**
   * Load property metadata for feature types not yet seen.
   *
   * @private
   */
  private async loadMissingFeatureTypeMetadata(
    featureBatch: SubmissionFeatureRecordWithTypeAndSecurity[],
    loadedFeatureTypeIds: Set<number>,
    metadataByFeatureType: Map<number, Map<string, FeatureTypePropertyMetadata>>,
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService
  ): Promise<void> {
    const featureTypesToLoad = [
      ...new Map(
        featureBatch
          .filter((feature) => !loadedFeatureTypeIds.has(feature.feature_type_id))
          .map((feature) => [
            feature.feature_type_id,
            {
              feature_type_id: feature.feature_type_id,
              feature_type_name: feature.feature_type_name
            }
          ])
      ).values()
    ];

    if (!featureTypesToLoad.length) {
      return;
    }

    const metadataRows = await submissionFeaturePropertyIndexService.getFeatureTypePropertyMetadata(featureTypesToLoad);
    const groupedMetadata = this.groupFeatureTypePropertyMetadata(metadataRows);

    for (const featureType of featureTypesToLoad) {
      loadedFeatureTypeIds.add(featureType.feature_type_id);
      if (!metadataByFeatureType.has(featureType.feature_type_id)) {
        metadataByFeatureType.set(featureType.feature_type_id, new Map<string, FeatureTypePropertyMetadata>());
      }
    }

    for (const [featureTypeId, metadataMap] of groupedMetadata.entries()) {
      metadataByFeatureType.set(featureTypeId, metadataMap);
    }
  }

  /**
   * Create mutable buckets used while collecting canonical property records.
   *
   * @private
   */
  private createPropertyRecordBuckets(): PropertyRecordBuckets {
    return {
      stringRecords: [],
      numberRecords: [],
      booleanRecords: [],
      timestampRecords: [],
      artifactRecords: [],
      pendingArtifactRecords: [],
      codeRecords: [],
      pendingCodeRecords: [],
      geometryRecords: [],
      taxonRecords: [],
      pendingTaxonRecords: []
    };
  }

  /**
   * Create mutable buckets used while collecting feature links for one batch.
   *
   * @private
   */
  private createFeatureBatchLinkBuckets(): FeatureBatchLinkBuckets {
    return {
      relationshipSourceIds: new Set<string>(),
      relationshipCandidates: [],
      parentSourceIds: new Set<string>(),
      parentCandidates: []
    };
  }

  /**
   * Collect canonical property records and feature links for one feature batch.
   *
   * @private
   */
  private extractPropertyAndLinkRecordsFromFeatureBatch(
    submissionId: number,
    featureBatch: SubmissionFeatureRecordWithTypeAndSecurity[],
    metadataByFeatureType: Map<number, Map<string, FeatureTypePropertyMetadata>>,
    propertyRecordBuckets: PropertyRecordBuckets,
    featureBatchLinkBuckets: FeatureBatchLinkBuckets
  ): void {
    for (const feature of featureBatch) {
      const featureTypeMetadata = metadataByFeatureType.get(feature.feature_type_id);
      if (!featureTypeMetadata) {
        continue;
      }

      this.extractPropertyRecordsFromFeature(submissionId, feature, featureTypeMetadata, propertyRecordBuckets);
      this.collectFeatureLinkCandidates(feature, featureBatchLinkBuckets);
    }
  }

  /**
   * Collect canonical property records for a single feature.
   *
   * @private
   */
  private extractPropertyRecordsFromFeature(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    featureTypeMetadata: Map<string, FeatureTypePropertyMetadata>,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    const featureProperties = this.getFeatureProperties(feature.data);

    for (const [propertyName, propertyValue] of Object.entries(featureProperties)) {
      if (propertyValue === null || propertyValue === undefined) {
        continue;
      }

      const matchingFeatureProperty = featureTypeMetadata.get(propertyName);
      if (!matchingFeatureProperty) {
        continue;
      }

      const values = Array.isArray(propertyValue) ? propertyValue : [propertyValue];
      this.validateMultipleValuesAllowed(submissionId, feature.submission_feature_id, propertyName, values.length, {
        allow_multiple: matchingFeatureProperty.allow_multiple
      });

      for (const currentValue of values) {
        if (currentValue === null || currentValue === undefined) {
          continue;
        }

        this.collectPropertyRecordByType(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
      }
    }
  }

  /**
   * Collect relationship and parent candidates from one feature.
   *
   * @private
   */
  private collectFeatureLinkCandidates(
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    featureBatchLinkBuckets: FeatureBatchLinkBuckets
  ): void {
    for (const referenceSourceId of this.getFeatureReferenceSourceIds(feature.data)) {
      featureBatchLinkBuckets.relationshipSourceIds.add(referenceSourceId);
      featureBatchLinkBuckets.relationshipCandidates.push({
        source_feature_id: feature.submission_feature_id,
        referenceSourceId
      });
    }

    const parentSourceId = this.getFeatureParentSourceId(feature.data);
    if (parentSourceId) {
      featureBatchLinkBuckets.parentSourceIds.add(parentSourceId);
      featureBatchLinkBuckets.parentCandidates.push({
        child_submission_feature_id: feature.submission_feature_id,
        parentSourceId
      });
    }
  }

  /**
   * Resolve and persist relationships/parents for one feature batch.
   *
   * @private
   */
  private async resolveFeatureLinksForBatch(
    submissionId: number,
    submissionUploadId: string,
    featureBatchLinkBuckets: FeatureBatchLinkBuckets,
    submissionRepository: SubmissionRepository
  ): Promise<void> {
    const sourceIds = [
      ...new Set([...featureBatchLinkBuckets.relationshipSourceIds, ...featureBatchLinkBuckets.parentSourceIds])
    ];

    if (!sourceIds.length) {
      return;
    }

    const resolvedSourceIdToFeatureId = await this.resolveFeatureSourceIdsByUpload(
      submissionUploadId,
      sourceIds,
      submissionRepository
    );

    await this.resolveFeatureRelationships(
      submissionId,
      resolvedSourceIdToFeatureId,
      featureBatchLinkBuckets.relationshipCandidates,
      submissionRepository
    );
    await this.resolveFeatureParents(
      submissionId,
      resolvedSourceIdToFeatureId,
      featureBatchLinkBuckets.parentCandidates,
      submissionRepository
    );
  }

  /**
   * Resolve and insert feature-to-feature relationships for one feature batch.
   *
   * @private
   */
  private async resolveFeatureRelationships(
    submissionId: number,
    resolvedSourceIdToFeatureId: Map<string, number>,
    relationshipCandidates: RelationshipCandidate[],
    submissionRepository: SubmissionRepository
  ): Promise<void> {
    if (!relationshipCandidates.length) {
      return;
    }

    const relationshipPairs: Array<{ source_feature_id: number; target_feature_id: number }> = [];

    for (const relationshipCandidate of relationshipCandidates) {
      const targetSubmissionFeatureId = resolvedSourceIdToFeatureId.get(relationshipCandidate.referenceSourceId);

      if (targetSubmissionFeatureId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve feature reference id', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: relationshipCandidate.source_feature_id,
            referenceSourceId: relationshipCandidate.referenceSourceId
          }
        ]);
      }

      relationshipPairs.push({
        source_feature_id: relationshipCandidate.source_feature_id,
        target_feature_id: targetSubmissionFeatureId
      });
    }

    if (relationshipPairs.length) {
      await submissionRepository.insertSubmissionFeatureRelationships(relationshipPairs);
    }
  }

  /**
   * Resolve and set parent links for one feature batch.
   *
   * @private
   */
  private async resolveFeatureParents(
    submissionId: number,
    resolvedSourceIdToFeatureId: Map<string, number>,
    parentCandidates: ParentCandidate[],
    submissionRepository: SubmissionRepository
  ): Promise<void> {
    if (!parentCandidates.length) {
      return;
    }

    const parentUpdates: Array<{ child_submission_feature_id: number; parent_submission_feature_id: number }> = [];

    for (const parentCandidate of parentCandidates) {
      const parentSubmissionFeatureId = resolvedSourceIdToFeatureId.get(parentCandidate.parentSourceId);

      if (parentSubmissionFeatureId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve parent feature id', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: parentCandidate.child_submission_feature_id,
            parentSourceId: parentCandidate.parentSourceId
          }
        ]);
      }

      parentUpdates.push({
        child_submission_feature_id: parentCandidate.child_submission_feature_id,
        parent_submission_feature_id: parentSubmissionFeatureId
      });
    }

    if (parentUpdates.length) {
      await submissionRepository.updateSubmissionFeatureParentsByChildIds(parentUpdates);
    }
  }

  /**
   * Resolve external source IDs to submission_feature IDs for one upload.
   *
   * @private
   */
  private async resolveFeatureSourceIdsByUpload(
    submissionUploadId: string,
    sourceIds: string[],
    submissionRepository: SubmissionRepository
  ): Promise<Map<string, number>> {
    const resolvedRows = await submissionRepository.getSubmissionFeatureIdMapBySourceIds(submissionUploadId, sourceIds);

    return new Map(resolvedRows.map((resolvedRow) => [resolvedRow.source_id, resolvedRow.submission_feature_id]));
  }

  /**
   * Validate that multiple values are only provided when property metadata allows it.
   *
   * @private
   */
  private validateMultipleValuesAllowed(
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string,
    valuesLength: number,
    matchingFeatureProperty: Pick<FeatureTypePropertyMetadata, 'allow_multiple'>
  ): void {
    if (matchingFeatureProperty.allow_multiple || valuesLength <= 1) {
      return;
    }

    throw new ApiExecuteSQLError('Property does not allow multiple values', [
      'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
      {
        submissionId,
        submission_feature_id: submissionFeatureId,
        propertyName,
        valuesLength
      }
    ]);
  }

  /**
   * Route a single property value to the type-specific collector.
   *
   * @private
   */
  private collectPropertyRecordByType(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    switch (matchingFeatureProperty.feature_property_type_name) {
      case 'string':
        this.collectStringRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'number':
        this.collectNumberRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'boolean':
        this.collectBooleanRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'timestamp':
        this.collectTimestampRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'artifact_key':
        this.collectArtifactRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'code':
        this.collectCodeRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'taxon':
        this.collectTaxonRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      case 'geometry':
        this.collectSpatialRecord(
          submissionId,
          feature,
          matchingFeatureProperty,
          propertyName,
          currentValue,
          propertyRecordBuckets
        );
        return;
      default:
        return;
    }
  }

  /**
   * Validate and collect a string property record.
   *
   * @private
   */
  private collectStringRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'string') {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'string', currentValue);
    }

    propertyRecordBuckets.stringRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      value: currentValue
    });
  }

  /**
   * Validate and collect a number property record.
   *
   * @private
   */
  private collectNumberRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'number', currentValue);
    }

    propertyRecordBuckets.numberRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      value: currentValue
    });
  }

  /**
   * Validate and collect a boolean property record.
   *
   * @private
   */
  private collectBooleanRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'boolean') {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'boolean', currentValue);
    }

    propertyRecordBuckets.booleanRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      value: currentValue
    });
  }

  /**
   * Validate, split, and collect a timestamp property record.
   *
   * @private
   */
  private collectTimestampRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'string') {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'timestamp', currentValue);
    }

    const splitTimestamp = splitTimestampValue(currentValue);
    if (!splitTimestamp.date && !splitTimestamp.time) {
      throw new ApiExecuteSQLError('Invalid timestamp property value', [
        'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
        {
          submissionId,
          submission_feature_id: feature.submission_feature_id,
          propertyName,
          value: currentValue
        }
      ]);
    }

    propertyRecordBuckets.timestampRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      date_value: splitTimestamp.date,
      time_value: splitTimestamp.time
    });
  }

  /**
   * Parse and collect a code property record for deferred slug resolution.
   *
   * @private
   */
  private collectCodeRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    const codeReference = this.parseCodeReferenceValue(
      currentValue,
      submissionId,
      feature.submission_feature_id,
      propertyName
    );

    propertyRecordBuckets.pendingCodeRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      propertyName,
      codeReference
    });
  }

  /**
   * Parse and collect an artifact property record for deferred artifact-id resolution.
   *
   * @private
   */
  private collectArtifactRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'string' || !currentValue.trim()) {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'artifact key', currentValue);
    }

    const normalizedReference = normalizeArtifactReference(currentValue);
    if (!normalizedReference) {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'artifact key', currentValue);
    }

    propertyRecordBuckets.pendingArtifactRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      propertyName,
      reference: normalizedReference
    });
  }

  /**
   * Validate and collect a taxon property record for deferred TSN resolution.
   *
   * @private
   */
  private collectTaxonRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'number' || !Number.isInteger(currentValue)) {
      this.throwTypeMismatch(
        submissionId,
        feature.submission_feature_id,
        propertyName,
        'taxon TSN (integer)',
        currentValue
      );
    }

    propertyRecordBuckets.pendingTaxonRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      propertyName,
      tsn: currentValue
    });
  }

  /**
   * Validate, normalize, and collect a geometry property record.
   *
   * @private
   */
  private collectSpatialRecord(
    submissionId: number,
    feature: SubmissionFeatureRecordWithTypeAndSecurity,
    matchingFeatureProperty: FeatureTypePropertyMetadata,
    propertyName: string,
    currentValue: unknown,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    if (typeof currentValue !== 'object' || currentValue === null) {
      this.throwTypeMismatch(submissionId, feature.submission_feature_id, propertyName, 'geometry', currentValue);
    }

    propertyRecordBuckets.geometryRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      value: this.normalizeSpatialValue(
        submissionId,
        feature.submission_feature_id,
        propertyName,
        currentValue
      ) as unknown as Record<string, unknown>
    });
  }

  /**
   * Normalize accepted geometry payload shapes to a GeoJSON Feature.
   *
   * @private
   */
  private normalizeSpatialValue(
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string,
    value: unknown
  ): Feature {
    const featureCollectionValidation = GeoJSONFeatureCollectionWithGeometryZodSchema.safeParse(value);
    if (featureCollectionValidation.success) {
      const geometries = featureCollectionValidation.data.features.map((featureItem) => featureItem.geometry);

      if (!geometries.length) {
        throw new ApiExecuteSQLError('Invalid geometry value for geometry property', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: submissionFeatureId,
            propertyName,
            reason: 'FeatureCollection does not contain any geometries'
          }
        ]);
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'GeometryCollection',
          geometries: geometries as unknown as Geometry[]
        } as Geometry,
        properties: null
      };
    }

    const featureValidation = GeoJSONFeatureWithGeometryZodSchema.safeParse(value);
    if (featureValidation.success) {
      return {
        type: 'Feature',
        geometry: featureValidation.data.geometry as unknown as Geometry,
        properties: null
      };
    }

    const geometryValidation = GeoJSONGeometryZodSchema.safeParse(value);
    if (geometryValidation.success) {
      return {
        type: 'Feature',
        geometry: geometryValidation.data as unknown as Geometry,
        properties: null
      };
    }

    const issues = [
      ...featureCollectionValidation.error.issues,
      ...featureValidation.error.issues,
      ...geometryValidation.error.issues
    ]
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .slice(0, 8);

    throw new ApiExecuteSQLError('Invalid geometry value for geometry property', [
      'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
      {
        submissionId,
        submission_feature_id: submissionFeatureId,
        propertyName,
        reason: 'Expected GeoJSON Geometry, Feature, or FeatureCollection',
        issues
      }
    ]);
  }

  /**
   * Resolve pending code slug records to contributor_codeset_code IDs.
   *
   * @private
   */
  private async resolveCodeProperties(
    submissionId: number,
    contributorId: number,
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService,
    pendingCodeRecords: PendingCodeRecord[],
    codeRecords: PropertyRecordBuckets['codeRecords']
  ): Promise<void> {
    if (!pendingCodeRecords.length) {
      return;
    }

    const uniqueCodeReferences = [
      ...new Map(pendingCodeRecords.map((record) => [record.codeReference.slug, record.codeReference])).values()
    ];

    const contributorCodeIdsBySlug =
      await submissionFeaturePropertyIndexService.resolveContributorCodesetCodeIdsByCodeReferences(
        contributorId,
        uniqueCodeReferences
      );

    for (const pendingCodeRecord of pendingCodeRecords) {
      const contributorCodesetCodeId = contributorCodeIdsBySlug.get(pendingCodeRecord.codeReference.slug);

      if (contributorCodesetCodeId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve code slug to contributor_codeset_code_id', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: pendingCodeRecord.submission_feature_id,
            propertyName: pendingCodeRecord.propertyName,
            slug: pendingCodeRecord.codeReference.slug,
            advice: 'Ensure the slug exists and resolves to a unique contributor_codeset_code row for this contributor.'
          }
        ]);
      }

      codeRecords.push({
        submission_feature_id: pendingCodeRecord.submission_feature_id,
        feature_type_property_id: pendingCodeRecord.feature_type_property_id,
        contributor_codeset_code_id: contributorCodesetCodeId
      });
    }
  }

  /**
   * Resolve pending artifact references to artifact IDs.
   *
   * @private
   */
  private async resolveArtifactProperties(
    submissionId: number,
    submissionUploadId: string,
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService,
    pendingArtifactRecords: PendingArtifactRecord[],
    artifactRecords: PropertyRecordBuckets['artifactRecords']
  ): Promise<void> {
    if (!pendingArtifactRecords.length) {
      return;
    }

    const uniqueReferences = [...new Set(pendingArtifactRecords.map((record) => record.reference))];
    const artifactIdByReference = await submissionFeaturePropertyIndexService.resolveArtifactIdsByReferences(
      submissionUploadId,
      uniqueReferences
    );

    for (const pendingArtifactRecord of pendingArtifactRecords) {
      const artifactId = artifactIdByReference.get(pendingArtifactRecord.reference);

      if (!artifactId) {
        throw new ApiExecuteSQLError('Failed to resolve artifact_key value', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: pendingArtifactRecord.submission_feature_id,
            propertyName: pendingArtifactRecord.propertyName,
            value: pendingArtifactRecord.reference
          }
        ]);
      }

      artifactRecords.push({
        submission_feature_id: pendingArtifactRecord.submission_feature_id,
        artifact_id: artifactId
      });
    }
  }

  /**
   * Resolve pending taxon TSN records to internal taxon IDs.
   *
   * @private
   */
  private async resolveTaxonProperties(
    submissionId: number,
    pendingTaxonRecords: PendingTaxonRecord[],
    taxonRecords: PropertyRecordBuckets['taxonRecords']
  ): Promise<void> {
    if (!pendingTaxonRecords.length) {
      return;
    }

    const taxonomyRepository = new TaxonomyRepository(this.connection);
    const taxonMatches = await taxonomyRepository.getTaxonByTsnIds([
      ...new Set(pendingTaxonRecords.map((record) => record.tsn))
    ]);
    const taxonByTsn = new Map(taxonMatches.map((match) => [match.itis_tsn, match.taxon_id]));

    for (const pendingTaxonRecord of pendingTaxonRecords) {
      const resolvedTaxonId = taxonByTsn.get(pendingTaxonRecord.tsn);

      if (resolvedTaxonId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve taxon value', [
          'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: pendingTaxonRecord.submission_feature_id,
            propertyName: pendingTaxonRecord.propertyName,
            value: pendingTaxonRecord.tsn
          }
        ]);
      }

      taxonRecords.push({
        submission_feature_id: pendingTaxonRecord.submission_feature_id,
        feature_type_property_id: pendingTaxonRecord.feature_type_property_id,
        taxon_id: resolvedTaxonId
      });
    }
  }

  /**
   * Persist collected canonical property records to typed property tables.
   *
   * @private
   */
  private async persistPropertyRecords(
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService,
    propertyRecordBuckets: PropertyRecordBuckets
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (propertyRecordBuckets.stringRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertStringRecords(propertyRecordBuckets.stringRecords));
    }

    if (propertyRecordBuckets.numberRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertNumberRecords(propertyRecordBuckets.numberRecords));
    }

    if (propertyRecordBuckets.booleanRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertBooleanRecords(propertyRecordBuckets.booleanRecords));
    }

    if (propertyRecordBuckets.timestampRecords.length) {
      promises.push(
        submissionFeaturePropertyIndexService.insertTimestampRecords(propertyRecordBuckets.timestampRecords)
      );
    }

    if (propertyRecordBuckets.artifactRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertArtifactRecords(propertyRecordBuckets.artifactRecords));
    }

    if (propertyRecordBuckets.codeRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertCodeRecords(propertyRecordBuckets.codeRecords));
    }

    if (propertyRecordBuckets.taxonRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertTaxonRecords(propertyRecordBuckets.taxonRecords));
    }

    if (propertyRecordBuckets.geometryRecords.length) {
      promises.push(submissionFeaturePropertyIndexService.insertGeometryRecords(propertyRecordBuckets.geometryRecords));
    }

    await Promise.all(promises);
  }

  /**
   * Group metadata rows by feature type and property name.
   *
   * @private
   */
  private groupFeatureTypePropertyMetadata(
    metadataRows: FeatureTypePropertyMetadata[]
  ): Map<number, Map<string, FeatureTypePropertyMetadata>> {
    const metadataByFeatureType = new Map<number, Map<string, FeatureTypePropertyMetadata>>();

    for (const metadataRow of metadataRows) {
      if (!metadataByFeatureType.has(metadataRow.feature_type_id)) {
        metadataByFeatureType.set(metadataRow.feature_type_id, new Map<string, FeatureTypePropertyMetadata>());
      }

      metadataByFeatureType.get(metadataRow.feature_type_id)?.set(metadataRow.feature_property_name, metadataRow);
    }

    return metadataByFeatureType;
  }

  /**
   * Parse and validate a code reference payload value.
   *
   * @private
   */
  private parseCodeReferenceValue(
    value: unknown,
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string
  ): CodeReference {
    if (typeof value !== 'string') {
      this.throwTypeMismatch(
        submissionId,
        submissionFeatureId,
        propertyName,
        'code slug (code::<contributor-codeset-key>::<contributor-codeset-code-key>)',
        value
      );
    }

    const parsed = parseCodeReference(value);
    if (!parsed) {
      throw new ApiExecuteSQLError('Invalid code slug format', [
        'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
        {
          submissionId,
          submission_feature_id: submissionFeatureId,
          propertyName,
          value,
          expected: 'code::<contributor-codeset-key>::<contributor-codeset-code-key>'
        }
      ]);
    }

    return parsed;
  }

  /**
   * Throw a standardized property type mismatch error.
   *
   * @private
   */
  private throwTypeMismatch(
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string,
    expectedType: string,
    value: unknown
  ): never {
    throw new ApiExecuteSQLError('Property value type mismatch', [
      'SubmissionFeaturePropertyIngestionService->indexSubmissionPropertiesBySubmissionUploadId',
      {
        submissionId,
        submission_feature_id: submissionFeatureId,
        propertyName,
        expectedType,
        receivedType: typeof value
      }
    ]);
  }

  /**
   * Extract properties from persisted raw feature payload.
   * Falls back to legacy payload shape for previously-ingested rows.
   *
   * @private
   */
  private getFeatureProperties(data: Record<string, unknown>): Record<string, unknown> {
    const value = data.properties;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return data;
  }

  /**
   * Extract parent source id from persisted raw feature payload.
   *
   * @private
   */
  private getFeatureParentSourceId(data: Record<string, unknown>): string | null {
    return typeof data.parent === 'string' && data.parent ? data.parent : null;
  }

  /**
   * Extract feature reference source ids from persisted raw feature payload.
   *
   * @private
   */
  private getFeatureReferenceSourceIds(data: Record<string, unknown>): string[] {
    const references = Array.isArray(data.references)
      ? data.references
      : Array.isArray(data.content)
      ? data.content
      : [];

    const referenceSourceIds: string[] = [];

    for (const reference of references) {
      if (typeof reference === 'string' && reference) {
        referenceSourceIds.push(reference);
      }
    }

    return referenceSourceIds;
  }
}
