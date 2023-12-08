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
    
    const propertyTypeMap = Object.fromEntries(featurePropertyTypeNames.map((propertyType) => {
      const { property_name, ...rest } = propertyType;
      return [property_name, rest];
    }))
    
    features.forEach((feature) => {
      const { submission_feature_id } = feature;
      Object
        .entries(feature.data.properties)
        .forEach(([property_name, value]) => {
          const { property_type,  feature_property_id } = propertyTypeMap[property_name];
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

    defaultLog.debug({ label: 'indexFeaturesBySubmissionId', datetimeRecords, numberRecords, spatialRecords, stringRecords });
  }
}
