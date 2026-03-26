import { FeatureCollection } from 'geojson';
import { IDBConnection } from '../database/db';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { CodeService } from './code-service';
import { DBService } from './db-service';
import {
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  ISearchFeaturesFilters,
  SearchFeatureResultWithRelevancy
} from './search-feature-service.interface';

const defaultLog = getLogger('services/search-feature-service');

/**
 * Service for searching features with multiple filter types.
 * Delegates to SearchFeatureRepository for all database operations.
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
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Array of features sorted by relevancy
   */
  async searchFeatures(
    filters: ISearchFeaturesFilters,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({ label: 'searchFeatures', filters, pagination });
    return this.searchFeatureRepository.searchFeaturesByFilters(filters, pagination, systemUserId);
  }

  /**
   * Gets the total count of features matching the search criteria.
   * Accepts multiple filter types (keywords, property filters, ITIS TSNs, property types)
   * and returns the count of results matching all criteria.
   *
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @return {Promise<number>} Total count of matching features
   */
  async getSearchFeaturesCount(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number> {
    defaultLog.debug({ label: 'getSearchFeaturesCount', filters });
    return this.searchFeatureRepository.searchFeaturesByFiltersCount(filters, systemUserId);
  }

  /**
   * Returns submission feature IDs matching the provided search filters.
   * Delegates to repository for the CTE-based query.
   *
   * @param {ISearchFeaturesFilters} filters - Search filters (keyword, feature_types, species, properties)
   * @returns {Promise<number[]>} Array of matching submission_feature_id values
   */
  async getSearchFeatureIds(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number[]> {
    defaultLog.debug({ label: 'getSearchFeatureIds', filters });
    const rows = await this.searchFeatureRepository.searchFeatureIdsByFilters(filters, systemUserId);
    return rows.map((row) => row.submission_feature_id);
  }

  /**
   * Creates search indexes for datetime, number, spatial and string properties belonging to
   * all features found for the given submission.
   *
   * Deletes existing search records first for idempotency — job retries and manual re-indexing
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

    const datetimeRecords: InsertDatetimeSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const spatialRecords: InsertSpatialSearchableRecord[] = [];
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
        const matchingFeatureProperty = applicableFeatureTypePropertyCodes.properties.find(
          (item) => item.name === currentFeaturePropertyName
        );

        if (!matchingFeatureProperty || !currentFeaturePropertyValue) {
          continue;
        }

        switch (matchingFeatureProperty.type_name) {
          case 'datetime':
            datetimeRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentFeaturePropertyValue as string
            });
            break;

          case 'number':
            numberRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentFeaturePropertyValue as number
            });
            break;

          case 'spatial':
            spatialRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentFeaturePropertyValue as FeatureCollection
            });
            break;

          case 'string':
            stringRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentFeaturePropertyValue as string
            });
            break;
        }
      }
    }

    const promises: Promise<any>[] = [];

    if (datetimeRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableDatetimeRecords(datetimeRecords));
    }

    if (numberRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableNumberRecords(numberRecords));
    }

    if (spatialRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableSpatialRecords(spatialRecords));
    }

    if (stringRecords.length) {
      promises.push(this.searchFeatureRepository.insertSearchableStringRecords(stringRecords));
    }

    await Promise.all(promises);
  }
}
