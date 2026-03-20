import { Feature, FeatureCollection, Geometry } from 'geojson';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { FeatureTypePropertyMetadata } from '../models/submission-feature-property-index';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import {
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionRepository
} from '../repositories/submission-repository';
import { TaxonomyRepository } from '../repositories/taxonomy-repository';
import { CodeReference, parseCodeReference } from '../utils/code-reference';
import { getLogger } from '../utils/logger';
import { splitTimestampValue } from '../utils/timestamp-utils';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { CodeService } from './code-service';
import { ContributorService } from './contributor-service';
import { DBService } from './db-service';
import {
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  PendingArtifactRecord,
  PendingCodeRecord,
  PendingTaxonRecord,
  PropertyRecordBuckets,
  SearchFeatureResultWithRelevancy,
  SearchFeaturesFilters
} from './search-feature-service.interface';
import { SubmissionFeaturePropertyIndexService } from './submission-feature-property-index-service';

const defaultLog = getLogger('services/search-feature-service');

/**
 * Service for searching features with multiple filter types.
 * Delegates to repositories for all database operations.
 */
export class SearchFeatureService extends DBService {
  searchFeatureRepository: SearchFeatureRepository;

  /**
   * Initializes the SearchFeatureService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
  }

  /**
   * Main search method for features.
   * Accepts multiple filter types (keywords, property filters, ITIS TSNs, property types)
   * and returns results matching all criteria with aggregated relevancy scores.
   *
   * @param {SearchFeaturesFilters} filters - Search filter criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Array of features sorted by relevancy
   */
  async searchFeatures(
    filters: SearchFeaturesFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({ label: 'searchFeatures', filters, pagination });
    return this.searchFeatureRepository.searchFeaturesByFilters(filters, pagination);
  }

  /**
   * Gets the total count of features matching the search criteria.
   * Accepts multiple filter types (keywords, property filters, ITIS TSNs, property types)
   * and returns the count of results matching all criteria.
   *
   * @param {SearchFeaturesFilters} filters - Search filter criteria
   * @return {Promise<number>} Total count of matching features
   */
  async getSearchFeaturesCount(filters: SearchFeaturesFilters): Promise<number> {
    defaultLog.debug({ label: 'getSearchFeaturesCount', filters });
    return this.searchFeatureRepository.searchFeaturesByFiltersCount(filters);
  }

  /**
   * Returns submission feature IDs matching the provided search filters.
   * Delegates to repository for the CTE-based query.
   *
   * @param {SearchFeaturesFilters} filters - Search filters (keyword, feature_types, species, properties)
   * @returns {Promise<number[]>} Array of matching submission_feature_id values
   */
  async getSearchFeatureIds(filters: SearchFeaturesFilters): Promise<number[]> {
    defaultLog.debug({ label: 'getSearchFeatureIds', filters });
    const rows = await this.searchFeatureRepository.searchFeatureIdsByFilters(filters);
    return rows.map((row) => row.submission_feature_id);
  }

  /**
   * Creates search indexes for timestamp, number, geometry and string properties belonging to
   * all features found for the given submission.
   *
   * Deletes existing search records first for idempotency - job retries and manual re-indexing
   * can run this multiple times for the same submission. Without delete-before-insert, duplicate
   * records accumulate because the search tables have no unique constraint on
   * (submission_feature_id, feature_property_id). Upsert was rejected because it can't clean up
   * orphaned rows when properties are removed between runs.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   */
  async indexFeaturesBySubmissionId(submissionId: number): Promise<void> {
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', message: 'start', submissionId });

    // Delete existing search records for idempotency (safe for retries and manual re-indexing)
    await this.searchFeatureRepository.deleteSearchRecordsBySubmissionId(submissionId);

    const timestampRecords: InsertDatetimeSearchableRecord[] = [];
    const artifactRecords: InsertStringSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const geometryRecords: InsertSpatialSearchableRecord[] = [];
    const stringRecords: InsertStringSearchableRecord[] = [];

    const submissionRepository = new SubmissionRepository(this.connection);
    const allFeatures = await submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const codeService = new CodeService(this.connection);
    const allFeatureTypePropertyCodes = await codeService.getFeatureTypePropertyCodes();

    for (const currentFeature of allFeatures) {
      const currentFeatureProperties = Object.entries(currentFeature.data);

      const applicableFeatureTypePropertyCodes = allFeatureTypePropertyCodes.find(
        (item) => item.feature_type.feature_type_id === currentFeature.feature_type_id
      );

      if (!applicableFeatureTypePropertyCodes) {
        continue;
      }

      for (const [currentFeaturePropertyName, currentFeaturePropertyValue] of currentFeatureProperties) {
        const matchingFeatureProperty = applicableFeatureTypePropertyCodes.feature_type_properties.find(
          (item) => item.feature_property_name === currentFeaturePropertyName
        );

        if (!matchingFeatureProperty || !currentFeaturePropertyValue) {
          continue;
        }

        switch (matchingFeatureProperty.feature_property_type_name) {
          case 'timestamp':
            timestampRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_property_id,
              value: currentFeaturePropertyValue as string
            });
            break;

          case 'number':
            numberRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_property_id,
              value: currentFeaturePropertyValue as number
            });
            break;
          case 'artifact_key':
            {
              const artifactReference = this.normalizeArtifactReference(currentFeaturePropertyValue);
              if (!artifactReference) {
                continue;
              }

              artifactRecords.push({
                submission_feature_id: currentFeature.submission_feature_id,
                feature_property_id: matchingFeatureProperty.feature_property_id,
                value: artifactReference
              });
            }
            break;

          case 'geometry':
            geometryRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_property_id,
              value: currentFeaturePropertyValue as FeatureCollection
            });
            break;

          case 'string':
            stringRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_property_id,
              value: currentFeaturePropertyValue as string
            });
            break;
        }
      }
    }

    const promises: Promise<unknown>[] = [];

    if (timestampRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableDatetimeRecords(timestampRecords));
    }

    if (artifactRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableStringRecords(artifactRecords));
    }

    if (numberRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableNumberRecords(numberRecords));
    }

    if (geometryRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableSpatialRecords(geometryRecords));
    }

    if (stringRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableStringRecords(stringRecords));
    }

    await Promise.all(promises);
  }

  /**
   * Indexes feature properties into canonical typed submission_feature_property_* tables.
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
    const submissionRepository = new SubmissionRepository(this.connection);
    await submissionFeaturePropertyIndexService.deletePropertyRecordsBySubmissionUploadId(submissionUploadId);
    await submissionRepository.clearSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId);
    await submissionRepository.deleteSubmissionFeatureRelationshipsBySubmissionUploadId(submissionUploadId);

    const metadataByFeatureType = new Map<number, Map<string, FeatureTypePropertyMetadata>>();
    const loadedFeatureTypeIds = new Set<number>();
    let cursorSubmissionFeatureId = 0;
    const batchSize = 10000;

    while (true) {
      const featureBatch = await submissionRepository.getSubmissionFeaturesBatchBySubmissionUploadId(
        submissionUploadId,
        cursorSubmissionFeatureId,
        batchSize
      );
      if (!featureBatch.length) {
        break;
      }

      const featureTypeIdsToLoad = [
        ...new Set(
          featureBatch
            .map((feature) => feature.feature_type_id)
            .filter((featureTypeId) => !loadedFeatureTypeIds.has(featureTypeId))
        )
      ];
      if (featureTypeIdsToLoad.length) {
        const metadataRows = await submissionFeaturePropertyIndexService.getFeatureTypePropertyMetadata(
          featureTypeIdsToLoad
        );
        const groupedMetadata = this.groupFeatureTypePropertyMetadata(metadataRows);

        for (const featureTypeId of featureTypeIdsToLoad) {
          loadedFeatureTypeIds.add(featureTypeId);
          if (!metadataByFeatureType.has(featureTypeId)) {
            metadataByFeatureType.set(featureTypeId, new Map<string, FeatureTypePropertyMetadata>());
          }
        }

        for (const [featureTypeId, metadataMap] of groupedMetadata.entries()) {
          metadataByFeatureType.set(featureTypeId, metadataMap);
        }
      }

      const propertyRecordBuckets = this.createPropertyRecordBuckets();
      this.extractPropertyRecordsFromFeatureBatch(
        submissionId,
        featureBatch,
        metadataByFeatureType,
        propertyRecordBuckets
      );

      await this.resolveArtifactProperties(
        submissionId,
        submissionUploadId,
        submissionFeaturePropertyIndexService,
        propertyRecordBuckets.pendingArtifactRecords,
        propertyRecordBuckets.artifactRecords
      );
      await this.resolveCodeProperties(
        submissionId,
        submissionFeaturePropertyIndexService,
        propertyRecordBuckets.pendingCodeRecords,
        propertyRecordBuckets.codeRecords
      );
      await this.resolveTaxonProperties(
        submissionId,
        propertyRecordBuckets.pendingTaxonRecords,
        propertyRecordBuckets.taxonRecords
      );
      await this.persistPropertyRecords(submissionFeaturePropertyIndexService, propertyRecordBuckets);
      await this.resolveFeatureRelationships(submissionId, submissionUploadId, featureBatch);
      await this.resolveFeatureParents(submissionId, submissionUploadId, featureBatch);

      if (featureBatch.length < batchSize) {
        break;
      }

      cursorSubmissionFeatureId = featureBatch[featureBatch.length - 1].submission_feature_id;
    }
  }

  /**
   * Create mutable buckets used while collecting canonical property records.
   *
   * @private
   * @return {PropertyRecordBuckets}
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
   * Collect canonical property records for all features in the submission.
   *
   * @private
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord[]} allFeatures
   * @param {Map<number, Map<string, FeatureTypePropertyMetadata>>} metadataByFeatureType
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
   */
  private extractPropertyRecordsFromFeatureBatch(
    submissionId: number,
    allFeatures: SubmissionFeatureRecordWithTypeAndSecurity[],
    metadataByFeatureType: Map<number, Map<string, FeatureTypePropertyMetadata>>,
    propertyRecordBuckets: PropertyRecordBuckets
  ): void {
    for (const feature of allFeatures) {
      const featureTypeMetadata = metadataByFeatureType.get(feature.feature_type_id);
      if (!featureTypeMetadata) {
        continue;
      }

      this.extractPropertyRecordsFromFeature(submissionId, feature, featureTypeMetadata, propertyRecordBuckets);
    }
  }

  /**
   * Collect canonical property records for a single feature.
   *
   * @private
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {Map<string, FeatureTypePropertyMetadata>} featureTypeMetadata
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * Resolve and insert feature-to-feature relationships for one feature batch.
   *
   * @private
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {SubmissionFeatureRecordWithTypeAndSecurity[]} featureBatch
   * @return {Promise<void>}
   */
  private async resolveFeatureRelationships(
    submissionId: number,
    submissionUploadId: string,
    featureBatch: SubmissionFeatureRecordWithTypeAndSecurity[]
  ): Promise<void> {
    const submissionRepository = new SubmissionRepository(this.connection);
    const referenceSourceIds = new Set<string>();
    const relationshipPairs: Array<{ source_feature_id: number; target_feature_id: number }> = [];

    for (const feature of featureBatch) {
      for (const referenceSourceId of this.getFeatureReferenceSourceIds(feature.data)) {
        referenceSourceIds.add(referenceSourceId);
      }
    }

    if (!referenceSourceIds.size) {
      return;
    }

    const resolvedSourceIdToFeatureId = await this.resolveFeatureSourceIdsByUpload(submissionUploadId, [
      ...referenceSourceIds
    ]);

    for (const feature of featureBatch) {
      for (const referenceSourceId of this.getFeatureReferenceSourceIds(feature.data)) {
        const targetSubmissionFeatureId = resolvedSourceIdToFeatureId.get(referenceSourceId);
        if (targetSubmissionFeatureId === undefined) {
          throw new ApiExecuteSQLError('Failed to resolve feature reference id', [
            'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
            {
              submissionId,
              submission_feature_id: feature.submission_feature_id,
              referenceSourceId
            }
          ]);
        }

        relationshipPairs.push({
          source_feature_id: feature.submission_feature_id,
          target_feature_id: targetSubmissionFeatureId
        });
      }
    }

    await submissionRepository.insertSubmissionFeatureRelationships(relationshipPairs);
  }

  /**
   * Resolve and set parent links for one feature batch.
   *
   * @private
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {SubmissionFeatureRecordWithTypeAndSecurity[]} featureBatch
   * @return {Promise<void>}
   */
  private async resolveFeatureParents(
    submissionId: number,
    submissionUploadId: string,
    featureBatch: SubmissionFeatureRecordWithTypeAndSecurity[]
  ): Promise<void> {
    const submissionRepository = new SubmissionRepository(this.connection);
    const parentSourceIds = new Set<string>();
    const parentUpdates: Array<{ child_submission_feature_id: number; parent_submission_feature_id: number }> = [];

    for (const feature of featureBatch) {
      const parentSourceId = this.getFeatureParentSourceId(feature.data);
      if (parentSourceId) {
        parentSourceIds.add(parentSourceId);
      }
    }

    if (!parentSourceIds.size) {
      return;
    }

    const resolvedSourceIdToFeatureId = await this.resolveFeatureSourceIdsByUpload(submissionUploadId, [
      ...parentSourceIds
    ]);

    for (const feature of featureBatch) {
      const parentSourceId = this.getFeatureParentSourceId(feature.data);
      if (!parentSourceId) {
        continue;
      }

      const parentSubmissionFeatureId = resolvedSourceIdToFeatureId.get(parentSourceId);
      if (parentSubmissionFeatureId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve parent feature id', [
          'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
          {
            submissionId,
            submission_feature_id: feature.submission_feature_id,
            parentSourceId
          }
        ]);
      }

      parentUpdates.push({
        child_submission_feature_id: feature.submission_feature_id,
        parent_submission_feature_id: parentSubmissionFeatureId
      });
    }

    await submissionRepository.updateSubmissionFeatureParents(parentUpdates);
  }

  /**
   * Resolve external source IDs to submission_feature IDs for one upload.
   *
   * @private
   * @param {string} submissionUploadId
   * @param {string[]} sourceIds
   * @return {Promise<Map<string, number>>}
   */
  private async resolveFeatureSourceIdsByUpload(
    submissionUploadId: string,
    sourceIds: string[]
  ): Promise<Map<string, number>> {
    const submissionRepository = new SubmissionRepository(this.connection);
    const resolvedRows = await submissionRepository.getSubmissionFeatureIdMapBySourceIds(submissionUploadId, sourceIds);

    return new Map(resolvedRows.map((resolvedRow) => [resolvedRow.source_id, resolvedRow.submission_feature_id]));
  }

  /**
   * Validate that multiple values are only provided when property metadata allows it.
   *
   * @private
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {string} propertyName
   * @param {number} valuesLength
   * @param {Pick<FeatureTypePropertyMetadata, 'allow_multiple'>} matchingFeatureProperty
   * @return {void}
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
      'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
        'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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

    propertyRecordBuckets.pendingArtifactRecords.push({
      submission_feature_id: feature.submission_feature_id,
      feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
      propertyName,
      reference: currentValue.trim()
    });
  }

  /**
   * Validate and collect a taxon property record for deferred TSN resolution.
   *
   * @private
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
   * @param {number} submissionId
   * @param {SubmissionFeatureRecord} feature
   * @param {FeatureTypePropertyMetadata} matchingFeatureProperty
   * @param {string} propertyName
   * @param {unknown} currentValue
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {void}
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
      value: this.normalizeSpatialValue(submissionId, feature.submission_feature_id, propertyName, currentValue)
    });
  }

  /**
   * Normalize accepted geometry payload shapes to a GeoJSON Feature.
   *
   * @private
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {string} propertyName
   * @param {unknown} value
   * @return {Feature}
   */
  private normalizeSpatialValue(
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string,
    value: unknown
  ): Feature {
    if ('features' in (value as object) && Array.isArray((value as { features?: unknown }).features)) {
      return {
        type: 'Feature',
        geometry: {
          type: 'GeometryCollection',
          geometries: (value as { features: Array<{ geometry?: Geometry }> }).features
            .map((feature) => feature.geometry)
            .filter((geometry): geometry is Geometry => !!geometry)
        },
        properties: null
      };
    }

    const geometryFeature = value as { type?: unknown; geometry?: unknown };
    if (geometryFeature.type !== 'Feature' || !geometryFeature.geometry) {
      throw new ApiExecuteSQLError('Invalid geometry value for geometry property', [
        'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
        {
          submissionId,
          submission_feature_id: submissionFeatureId,
          propertyName
        }
      ]);
    }

    return value as Feature;
  }

  /**
   * Resolve pending code slug records to contributor_codeset_code IDs.
   *
   * @private
   * @param {number} submissionId
   * @param {SubmissionFeaturePropertyIndexService} submissionFeaturePropertyIndexService
   * @param {PendingCodeRecord[]} pendingCodeRecords
   * @param {PropertyRecordBuckets['codeRecords']} codeRecords
   * @return {Promise<void>}
   */
  private async resolveCodeProperties(
    submissionId: number,
    submissionFeaturePropertyIndexService: SubmissionFeaturePropertyIndexService,
    pendingCodeRecords: PendingCodeRecord[],
    codeRecords: PropertyRecordBuckets['codeRecords']
  ): Promise<void> {
    if (!pendingCodeRecords.length) {
      return;
    }

    const contributorService = new ContributorService(this.connection);
    const contributor = await contributorService.getContributorBySubmissionId(submissionId);
    const uniqueCodeReferences = [
      ...new Map(pendingCodeRecords.map((record) => [record.codeReference.slug, record.codeReference])).values()
    ];
    const contributorCodeIdsBySlug =
      await submissionFeaturePropertyIndexService.resolveContributorCodesetCodeIdsByCodeReferences(
        contributor.contributor_id,
        uniqueCodeReferences
      );

    for (const pendingCodeRecord of pendingCodeRecords) {
      const contributorCodesetCodeId = contributorCodeIdsBySlug.get(pendingCodeRecord.codeReference.slug);

      if (contributorCodesetCodeId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve code slug to contributor_codeset_code_id', [
          'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {SubmissionFeaturePropertyIndexService} submissionFeaturePropertyIndexService
   * @param {PendingArtifactRecord[]} pendingArtifactRecords
   * @param {PropertyRecordBuckets['artifactRecords']} artifactRecords
   * @return {Promise<void>}
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
          'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {number} submissionId
   * @param {PendingTaxonRecord[]} pendingTaxonRecords
   * @param {PropertyRecordBuckets['taxonRecords']} taxonRecords
   * @return {Promise<void>}
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
    // Desired state: taxon properties persist internal `taxon_id`, resolved from external TSN payload values.
    const taxonMatches = await taxonomyRepository.getTaxonByTsnIds([
      ...new Set(pendingTaxonRecords.map((record) => record.tsn))
    ]);
    const taxonByTsn = new Map(taxonMatches.map((match) => [match.itis_tsn, match.taxon_id]));

    for (const pendingTaxonRecord of pendingTaxonRecords) {
      const resolvedTaxonId = taxonByTsn.get(pendingTaxonRecord.tsn);

      if (resolvedTaxonId === undefined) {
        throw new ApiExecuteSQLError('Failed to resolve taxon value', [
          'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {SubmissionFeaturePropertyIndexService} submissionFeaturePropertyIndexService
   * @param {PropertyRecordBuckets} propertyRecordBuckets
   * @return {Promise<void>}
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
   * @param {FeatureTypePropertyMetadata[]} metadataRows
   * @return {Map<number, Map<string, FeatureTypePropertyMetadata>>}
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
   * @param {unknown} value
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {string} propertyName
   * @return {CodeReference}
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
        'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {string} propertyName
   * @param {string} expectedType
   * @param {unknown} value
   * @return {never}
   */
  private throwTypeMismatch(
    submissionId: number,
    submissionFeatureId: number,
    propertyName: string,
    expectedType: string,
    value: unknown
  ): never {
    throw new ApiExecuteSQLError('Property value type mismatch', [
      'SearchFeatureService->indexSubmissionPropertiesBySubmissionUploadId',
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
   * @param {Record<string, unknown>} data
   * @return {Record<string, unknown>}
   */
  private getFeatureProperties(data: Record<string, unknown>): Record<string, unknown> {
    const value = data.properties;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return data;
  }

  /**
   * Normalize legacy search indexing value for artifact keys.
   *
   * @private
   * @param {unknown} value
   * @return {string | null}
   */
  private normalizeArtifactReference(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'object' && value !== null) {
      const objectValue = value as Record<string, unknown>;
      if (typeof objectValue.file === 'string' && objectValue.file.trim()) {
        return objectValue.file.trim();
      }
    }

    return null;
  }

  /**
   * Extract parent source id from persisted raw feature payload.
   *
   * @private
   * @param {Record<string, unknown>} data
   * @return {string | null}
   */
  private getFeatureParentSourceId(data: Record<string, unknown>): string | null {
    return typeof data.parent === 'string' && data.parent ? data.parent : null;
  }

  /**
   * Extract feature reference source ids from persisted raw feature payload.
   *
   * @private
   * @param {Record<string, unknown>} data
   * @return {string[]}
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
