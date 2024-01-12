import { FeatureCollection } from 'geojson';
import { IDBConnection } from '../database/db';
import {
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  SearchIndexRepository
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
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', submissionId });

    const datetimeRecords: InsertDatetimeSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const spatialRecords: InsertSpatialSearchableRecord[] = [];
    const stringRecords: InsertStringSearchableRecord[] = [];

    const submissionRepository = new SubmissionRepository(this.connection);
    const allFeatures = await submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const codeService = new CodeService(this.connection);
    const featureTypePropertyCodes = await codeService.getFeatureTypePropertyCodes();

    for (const currentFeature of allFeatures) {
      const currentFeatureProperties = Object.entries(currentFeature.data);

      const applicableFeatureProperties = featureTypePropertyCodes.find(
        (item) => item.feature_type.feature_type_id === currentFeature.feature_type_id
      );

      if (!applicableFeatureProperties) {
        continue;
      }

      for (const [currentFeaturePropertyName, currentFeaturePropertyValue] of currentFeatureProperties) {
        const matchingFeatureProperty = applicableFeatureProperties.feature_type_properties.find(
          (item) => item.feature_property_name === currentFeaturePropertyName
        );

        if (!matchingFeatureProperty) {
          continue;
        }

        switch (matchingFeatureProperty.feature_property_type_name) {
          case 'datetime':
            if (!currentFeaturePropertyValue) {
              // Datetime value is null or undefined, since the submission system accepts null dates (e.g. `{ end_date: null }`)
              return;
            }

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
}
