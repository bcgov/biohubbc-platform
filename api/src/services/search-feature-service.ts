import { Feature, FeatureCollection, Geometry } from 'geojson';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionFeaturePropertyIndexRepository } from '../repositories/submission-feature-property-index-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { TaxonomyRepository } from '../repositories/taxonomy-repository';
import { CodeReference, parseCodeReference } from '../utils/code-reference';
import { getLogger } from '../utils/logger';
import { splitTimestampValue } from '../utils/timestamp-utils';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { CodeService } from './code-service';
import { ContributorService } from './contributor-service';
import { DBService } from './db-service';
import {
  FeatureTypePropertyMetadataRow,
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  InsertSubmissionFeaturePropertyBoolean,
  InsertSubmissionFeaturePropertyCode,
  InsertSubmissionFeaturePropertyGeometry,
  InsertSubmissionFeaturePropertyNumber,
  InsertSubmissionFeaturePropertyString,
  InsertSubmissionFeaturePropertyTaxon,
  InsertSubmissionFeaturePropertyTimestamp,
  ISearchFeaturesFilters,
  SearchFeatureResultWithRelevancy
} from './search-feature-service.interface';

const defaultLog = getLogger('services/search-feature-service');

type PendingTaxonRecord = {
  submission_feature_id: number;
  feature_type_property_id: number;
  propertyName: string;
  tsn: number;
};

type PendingCodeRecord = {
  submission_feature_id: number;
  feature_type_property_id: number;
  codeReference: CodeReference;
};

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
   *
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Array of features sorted by relevancy
   */
  async searchFeatures(
    filters: ISearchFeaturesFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({ label: 'searchFeatures', filters, pagination });
    return this.searchFeatureRepository.searchFeaturesByFilters(filters, pagination);
  }

  /**
   * Gets the total count of features matching the search criteria.
   *
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @return {Promise<number>} Total count of matching features
   */
  async getSearchFeaturesCount(filters: ISearchFeaturesFilters): Promise<number> {
    defaultLog.debug({ label: 'getSearchFeaturesCount', filters });
    return this.searchFeatureRepository.searchFeaturesByFiltersCount(filters);
  }

  /**
   * Returns submission feature IDs matching the provided search filters.
   *
   * @param {ISearchFeaturesFilters} filters - Search filters (keyword, feature_types, species, properties)
   * @returns {Promise<number[]>} Array of matching submission_feature_id values
   */
  async getSearchFeatureIds(filters: ISearchFeaturesFilters): Promise<number[]> {
    defaultLog.debug({ label: 'getSearchFeatureIds', filters });
    const rows = await this.searchFeatureRepository.searchFeatureIdsByFilters(filters);
    return rows.map((row) => row.submission_feature_id);
  }

  /**
   * Creates search indexes for datetime, number, spatial and string properties belonging to
   * all features found for the given submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   */
  async indexFeaturesBySubmissionId(submissionId: number): Promise<void> {
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', message: 'start', submissionId });

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
        const matchingFeatureProperty = applicableFeatureTypePropertyCodes.feature_type_properties.find(
          (item) => item.feature_property_name === currentFeaturePropertyName
        );

        if (!matchingFeatureProperty || !currentFeaturePropertyValue) {
          continue;
        }

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

    const promises: Promise<unknown>[] = [];

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

  /**
   * Indexes feature properties into canonical typed submission_feature_property_* tables.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   */
  async indexSubmissionPropertiesBySubmissionId(submissionId: number): Promise<void> {
    defaultLog.debug({
      label: 'indexSubmissionPropertiesBySubmissionId',
      message: 'start',
      submissionId
    });

    const submissionFeaturePropertyIndexRepository = new SubmissionFeaturePropertyIndexRepository(this.connection);
    // Idempotency: canonical typed property tables are fully rebuilt per submission.
    await submissionFeaturePropertyIndexRepository.deletePropertyRecordsBySubmissionId(submissionId);

    const submissionRepository = new SubmissionRepository(this.connection);
    const allFeatures = await submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);
    if (!allFeatures.length) {
      return;
    }

    const featureTypeIdSet = new Set<number>();
    for (const feature of allFeatures) {
      featureTypeIdSet.add(feature.feature_type_id);
    }

    const featureTypeIds = [...featureTypeIdSet];
    const metadataRows = await submissionFeaturePropertyIndexRepository.getFeatureTypePropertyMetadata(featureTypeIds);
    const metadataByFeatureType = this.groupFeatureTypePropertyMetadata(metadataRows);

    const stringRecords: InsertSubmissionFeaturePropertyString[] = [];
    const numberRecords: InsertSubmissionFeaturePropertyNumber[] = [];
    const booleanRecords: InsertSubmissionFeaturePropertyBoolean[] = [];
    const timestampRecords: InsertSubmissionFeaturePropertyTimestamp[] = [];
    const codeRecords: InsertSubmissionFeaturePropertyCode[] = [];
    const pendingCodeRecords: PendingCodeRecord[] = [];
    const geometryRecords: InsertSubmissionFeaturePropertyGeometry[] = [];
    const taxonRecords: InsertSubmissionFeaturePropertyTaxon[] = [];
    const pendingTaxonRecords: PendingTaxonRecord[] = [];

    for (const currentFeature of allFeatures) {
      const featureTypeMetadata = metadataByFeatureType.get(currentFeature.feature_type_id);
      if (!featureTypeMetadata) {
        continue;
      }

      const currentFeatureData = currentFeature.data;
      for (const currentFeaturePropertyName in currentFeatureData) {
        const currentFeaturePropertyValue = currentFeatureData[currentFeaturePropertyName];

        if (currentFeaturePropertyValue === null || currentFeaturePropertyValue === undefined) {
          continue;
        }

        const matchingFeatureProperty = featureTypeMetadata.get(currentFeaturePropertyName);
        if (!matchingFeatureProperty) {
          continue;
        }

        const values = Array.isArray(currentFeaturePropertyValue)
          ? currentFeaturePropertyValue
          : [currentFeaturePropertyValue];
        // Desired state: arrays are represented as multiple rows in typed property tables.

        if (!matchingFeatureProperty.allow_multiple && values.length > 1) {
          throw new ApiExecuteSQLError('Property does not allow multiple values', [
            'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
            {
              submissionId,
              submission_feature_id: currentFeature.submission_feature_id,
              propertyName: currentFeaturePropertyName,
              valuesLength: values.length
            }
          ]);
        }

        for (const currentValue of values) {
          if (currentValue === null || currentValue === undefined) {
            continue;
          }

          const propertyType = matchingFeatureProperty.feature_property_type_name;

          if (propertyType === 'string') {
            if (typeof currentValue !== 'string') {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'string',
                currentValue
              );
            }
            stringRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentValue
            });
            continue;
          }

          if (propertyType === 'number') {
            if (typeof currentValue !== 'number' || Number.isNaN(currentValue)) {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'number',
                currentValue
              );
            }
            numberRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentValue
            });
            continue;
          }

          if (propertyType === 'boolean') {
            if (typeof currentValue !== 'boolean') {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'boolean',
                currentValue
              );
            }
            booleanRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              value: currentValue
            });
            continue;
          }

          if (propertyType === 'timestamp') {
            if (typeof currentValue !== 'string') {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'timestamp',
                currentValue
              );
            }

            const splitTimestamp = splitTimestampValue(currentValue);
            if (!splitTimestamp.date && !splitTimestamp.time) {
              throw new ApiExecuteSQLError('Invalid timestamp property value', [
                'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
                {
                  submissionId,
                  submission_feature_id: currentFeature.submission_feature_id,
                  propertyName: currentFeaturePropertyName,
                  value: currentValue
                }
              ]);
            }

            timestampRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              date_value: splitTimestamp.date,
              time_value: splitTimestamp.time
            });
            continue;
          }

          if (propertyType === 'code') {
            const codeReference = this.parseCodeReferenceValue(
              currentValue,
              submissionId,
              currentFeature.submission_feature_id,
              currentFeaturePropertyName
            );

            pendingCodeRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              codeReference
            });
            continue;
          }

          if (propertyType === 'taxon') {
            if (typeof currentValue !== 'number' || !Number.isInteger(currentValue)) {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'taxon TSN (integer)',
                currentValue
              );
            }

            pendingTaxonRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              propertyName: currentFeaturePropertyName,
              tsn: currentValue
            });
            continue;
          }

          if (propertyType === 'spatial') {
            if (typeof currentValue !== 'object' || currentValue === null) {
              this.throwTypeMismatch(
                submissionId,
                currentFeature.submission_feature_id,
                currentFeaturePropertyName,
                'spatial',
                currentValue
              );
            }

            // Keep FeatureCollection compatibility by normalizing to a GeoJSON Feature.
            const spatialValue =
              'features' in currentValue && Array.isArray((currentValue as { features?: unknown }).features)
                ? ({
                    type: 'Feature',
                    geometry: {
                      type: 'GeometryCollection',
                      geometries: (currentValue as { features: Array<{ geometry?: Geometry }> }).features
                        .map((feature) => feature.geometry)
                        .filter((geometry): geometry is Geometry => !!geometry)
                    },
                    properties: null
                  } as Feature)
                : (() => {
                    const spatialFeature = currentValue as { type?: unknown; geometry?: unknown };

                    if (spatialFeature.type !== 'Feature' || !spatialFeature.geometry) {
                      throw new ApiExecuteSQLError('Invalid spatial value for geometry property', [
                        'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
                        {
                          submissionId,
                          submission_feature_id: currentFeature.submission_feature_id,
                          propertyName: currentFeaturePropertyName
                        }
                      ]);
                    }

                    return currentValue as Feature;
                  })();

            geometryRecords.push({
              submission_feature_id: currentFeature.submission_feature_id,
              feature_type_property_id: matchingFeatureProperty.feature_type_property_id,
              value: spatialValue
            });
          }
        }
      }
    }

    // Resolve each `code::<contributor-codeset-key>::<contributor-codeset-code-key>` slug
    // to a stable contributor_codeset_code_id.
    // This only requires the database. Codes are already persisted during ingestion, so property indexing only
    // does a set-based lookup and then maps slug -> FK in memory for fast assignment.
    if (pendingCodeRecords.length) {
      const contributorService = new ContributorService(this.connection);
      const contributor = await contributorService.getContributorBySubmissionId(submissionId);
      const uniqueCodeReferences = [
        ...new Map(pendingCodeRecords.map((record) => [record.codeReference.slug, record.codeReference])).values()
      ];
      const codesetSlugMap =
        await submissionFeaturePropertyIndexRepository.resolveContributorCodesetCodeIdsByCodeReferences(
          contributor.contributor_id,
          uniqueCodeReferences
        );

      for (const pendingCodeRecord of pendingCodeRecords) {
        const contributorCodesetCodeId = codesetSlugMap.get(pendingCodeRecord.codeReference.slug);

        if (contributorCodesetCodeId === undefined) {
          throw new ApiExecuteSQLError('Failed to resolve code slug to contributor_codeset_code_id', [
            'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
            {
              submissionId,
              submission_feature_id: pendingCodeRecord.submission_feature_id,
              slug: pendingCodeRecord.codeReference.slug,
              advice:
                'Ensure the slug exists and resolves to a unique contributor_codeset_code row for this contributor.'
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

    if (pendingTaxonRecords.length) {
      const taxonomyRepository = new TaxonomyRepository(this.connection);
      // Desired state: taxon properties persist internal `taxon_id`, resolved from external TSN payload values.
      const taxonMatches = await taxonomyRepository.getTaxonByTsnIds([
        ...new Set(pendingTaxonRecords.map((record) => record.tsn))
      ]);
      const taxonByTsn = new Map(taxonMatches.map((match) => [match.itis_tsn, match.taxon_id]));

      for (const pendingTaxonRecord of pendingTaxonRecords) {
        const resolvedTaxonId = taxonByTsn.get(pendingTaxonRecord.tsn);

        if (!resolvedTaxonId) {
          throw new ApiExecuteSQLError('Failed to resolve taxon value', [
            'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
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

    const promises: Promise<void>[] = [];

    if (stringRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertStringRecords(stringRecords));
    }

    if (numberRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertNumberRecords(numberRecords));
    }

    if (booleanRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertBooleanRecords(booleanRecords));
    }

    if (timestampRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertTimestampRecords(timestampRecords));
    }

    if (codeRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertCodeRecords(codeRecords));
    }

    if (taxonRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertTaxonRecords(taxonRecords));
    }

    if (geometryRecords.length) {
      promises.push(submissionFeaturePropertyIndexRepository.insertGeometryRecords(geometryRecords));
    }

    await Promise.all(promises);
  }

  /**
   * Group metadata rows by feature type and property name.
   *
   * @private
   * @param {FeatureTypePropertyMetadataRow[]} metadataRows
   * @return {Map<number, Map<string, FeatureTypePropertyMetadataRow>>}
   */
  private groupFeatureTypePropertyMetadata(
    metadataRows: FeatureTypePropertyMetadataRow[]
  ): Map<number, Map<string, FeatureTypePropertyMetadataRow>> {
    const metadataByFeatureType = new Map<number, Map<string, FeatureTypePropertyMetadataRow>>();

    for (const metadataRow of metadataRows) {
      if (!metadataByFeatureType.has(metadataRow.feature_type_id)) {
        metadataByFeatureType.set(metadataRow.feature_type_id, new Map<string, FeatureTypePropertyMetadataRow>());
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
        'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
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
      'SearchFeatureService->indexSubmissionPropertiesBySubmissionId',
      {
        submissionId,
        submission_feature_id: submissionFeatureId,
        propertyName,
        expectedType,
        receivedType: typeof value
      }
    ]);
  }
}
