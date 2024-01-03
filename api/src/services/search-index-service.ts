import { FeatureCollection } from 'geojson';
import { IDBConnection } from '../database/db';
import {
  FeaturePropertyRecordWithPropertyTypeName,
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  SearchIndexRepository
} from '../repositories/search-index-respository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
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
    defaultLog.debug({ label: 'indexFeaturesBySubmissionId' });

    const datetimeRecords: InsertDatetimeSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const spatialRecords: InsertSpatialSearchableRecord[] = [];
    const stringRecords: InsertStringSearchableRecord[] = [];

    const submissionRepository = new SubmissionRepository(this.connection);
    const features = await submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    const featurePropertyTypeNames: FeaturePropertyRecordWithPropertyTypeName[] =
      await this.searchIndexRepository.getFeaturePropertiesWithTypeNames();
    const featurePropertyTypeMap: Record<string, FeaturePropertyRecordWithPropertyTypeName> = Object.fromEntries(
      featurePropertyTypeNames.map((propertyType) => {
        const { name } = propertyType;
        return [name, propertyType];
      })
    );

    features.forEach((feature) => {
      const { submission_feature_id } = feature;
      Object.entries(feature.data).forEach(([feature_property_name, value]) => {
        const featureProperty = featurePropertyTypeMap[feature_property_name];
        if (!featureProperty) {
          return;
        }

        const { feature_property_type_name, feature_property_id } = featureProperty;

        switch (feature_property_type_name) {
          case 'datetime':
            if (!value) {
              // Datetime value is null or undefined, since the submission system accepts null dates (e.g. `{ end_date: null }`)
              return;
            }

            datetimeRecords.push({ submission_feature_id, feature_property_id, value: value as string });
            break;

          case 'number':
            numberRecords.push({ submission_feature_id, feature_property_id, value: value as number });
            break;

          case 'spatial':
            spatialRecords.push({ submission_feature_id, feature_property_id, value: value as FeatureCollection });
            break;

          case 'string':
            stringRecords.push({ submission_feature_id, feature_property_id, value: value as string });
            break;
        }
      });
    });

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
