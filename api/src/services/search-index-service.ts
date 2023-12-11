import { IDBConnection } from "../database/db";
import { Geometry, InsertDatetimeSearchableRecord, InsertNumberSearchableRecord, InsertSpatialSearchableRecord, InsertStringSearchableRecord, SearchIndexRepository } from "../repositories/search-index-respository";
import { SubmissionRepository } from "../repositories/submission-repository";
import { getLogger } from "../utils/logger";
import { DBService } from "./db-service";

const defaultLog = getLogger('services/search-index-service');

export class SearchIndexService extends DBService {
  searchIndexRepository: SearchIndexRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.searchIndexRepository = new SearchIndexRepository(connection);
  }

  async indexFeaturesBySubmissionId(submissionId: number): Promise<void> {
    const submissionRepository = new SubmissionRepository(this.connection);
    const features = await submissionRepository.getFeatureRecordsBySubmissionId(submissionId);

    const datetimeRecords: InsertDatetimeSearchableRecord[] = [];
    const numberRecords: InsertNumberSearchableRecord[] = [];
    const spatialRecords: InsertSpatialSearchableRecord[] = [];
    const stringRecords: InsertStringSearchableRecord[] = [];

    const featurePropertyTypeNames = await this.searchIndexRepository.getFeaturePropertiesWithTypeNames();

    const featurePropertyTypeMap = Object.fromEntries(featurePropertyTypeNames.map((propertyType) => {
      const { property_name, ...rest } = propertyType;
      return [property_name, rest];
    }))

    defaultLog.debug({ featurePropertyTypeMap })
    
    features.forEach((feature) => {
      const { submission_feature_id } = feature;
      Object
        .entries(feature.data.properties)
        .forEach(([property_name, value]) => {          
          const featureProperty = featurePropertyTypeMap[property_name];
          if (!featureProperty) {
            return;
          }

          const { property_type,  feature_property_id } = featureProperty;

          switch (property_type) {
            case 'datetime':
              datetimeRecords.push({ submission_feature_id, feature_property_id, value: value as Date });
              break;

            case 'number':
              numberRecords.push({ submission_feature_id, feature_property_id, value: value as number });
              break;

            case 'spatial':
              spatialRecords.push({ submission_feature_id, feature_property_id, value: value as Geometry });
              break;

            case 'string':
              stringRecords.push({ submission_feature_id, feature_property_id, value: value as string });
              break;
          }
        })
      });

    
    if (datetimeRecords.length) {
      this.searchIndexRepository.insertSearchableDatetimeRecords(datetimeRecords);
    }
    if (numberRecords.length) {
      this.searchIndexRepository.insertSearchableNumberRecords(numberRecords);
    }
    if (spatialRecords.length) {
      this.searchIndexRepository.insertSearchableSpatialRecords(spatialRecords);
    }
    if (stringRecords.length) {
      this.searchIndexRepository.insertSearchableStringRecords(stringRecords);
    }
  }
}
