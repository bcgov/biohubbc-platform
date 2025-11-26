import { FeatureCollection } from 'geojson';
import { IDBConnection } from '../database/db';
import {
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  SearchIndexRepository,
  SubmissionFeatureCombinedSearchValues,
  SubmissionFeatureSearchKeyValues
} from '../repositories/search-index-respository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { CodeService } from './code-service';
import { DBService } from './db-service';

const defaultLog = getLogger('services/search-index-service');

export class SearchIndexService extends DBService {
  searchIndexRepository: SearchIndexRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.searchIndexRepository = new SearchIndexRepository(connection);
  }

  /**
   * Creates search indexes for datetime, number, spatial and string properties belonging to
   * all features found for the given submission.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof SearchIndexService
   */
  async indexFeaturesBySubmissionId(submissionId: number): Promise<void> {
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', message: 'start', submissionId });

    const datetimeRecords: InsertDatetimeSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const spatialRecords: InsertSpatialSearchableRecord[] = [];
    const stringRecords: InsertStringSearchableRecord[] = [];

    const submissionRepository = new SubmissionRepository(this.connection);
    const allFeatures = await submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const codeService = new CodeService(this.connection);
    const allFeatureTypePropertyCodes = await codeService.getFeatureTypePropertyCodes();

    for (const currentFeature of allFeatures) {
      // All properties of the current feature
      const currentFeatureProperties = Object.entries(currentFeature.data);

      // The property codes for the current feature's type
      const applicableFeatureTypePropertyCodes = allFeatureTypePropertyCodes.find(
        (item) => item.feature_type.feature_type_id === currentFeature.feature_type_id
      );

      if (!applicableFeatureTypePropertyCodes) {
        // No matching property codes found, nothing to index for the current feature
        continue;
      }

      // For each property of the current feature
      for (const [currentFeaturePropertyName, currentFeaturePropertyValue] of currentFeatureProperties) {
        const matchingFeatureProperty = applicableFeatureTypePropertyCodes.feature_type_properties.find(
          (item) => item.feature_property_name === currentFeaturePropertyName
        );

        if (!matchingFeatureProperty) {
          // No matching property code found
          continue;
        }

        if (!currentFeaturePropertyValue) {
          // Skip null values
          continue;
        }

        // Matching property code found, add query data to matching array
        switch (matchingFeatureProperty.feature_property_type_name) {
          case 'datetime':
            datetimeRecords.push({
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

          case 'spatial':
            spatialRecords.push({
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

    const promises: Promise<any>[] = [];

    // Execute insert queries for all non-empty search index arrays
    if (datetimeRecords.length) {
      promises.push(this.searchIndexRepository.insertSearchableDatetimeRecords(datetimeRecords));
    }
    if (numberRecords.length) {
      promises.push(this.searchIndexRepository.insertSearchableNumberRecords(numberRecords));
    }
    if (spatialRecords.length) {
      promises.push(this.searchIndexRepository.insertSearchableSpatialRecords(spatialRecords));
    }
    if (stringRecords.length) {
      promises.push(this.searchIndexRepository.insertSearchableStringRecords(stringRecords));
    }

    await Promise.all(promises);
  }

  /**
   * Retrieves all search values, for all search types (string, number, datetime, spatial), for the given submission
   * feature in one unified result set.
   *
   * @param {number} submissionFeatureId
   * @return {*}  {Promise<SubmissionFeatureCombinedSearchValues[]>}
   * @memberof SearchIndexService
   */
  async getCombinedSearchKeyValuesBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeatureCombinedSearchValues[]> {
    return this.searchIndexRepository.getCombinedSearchKeyValuesBySubmissionFeatureId(submissionFeatureId);
  }

  /**
   * Retrieves all search values, for all search types (string, number, datetime, spatial), for all submission feature
   * belonging to the given submission.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<SubmissionFeatureSearchKeyValues[]>}
   * @memberof SearchIndexService
   */
  async getSearchKeyValuesBySubmissionId(submissionId: number): Promise<SubmissionFeatureSearchKeyValues[]> {
    return this.searchIndexRepository.getSearchKeyValuesBySubmissionId(submissionId);
  }
}
