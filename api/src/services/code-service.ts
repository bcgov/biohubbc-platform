import { IDBConnection } from '../database/db';
import {
  CodeRepository,
  FeatureTypeCode,
  FeatureTypeWithFeaturePropertiesCode,
  IAllCodeSets
} from '../repositories/code-repository';
import { FeaturePropertyRecord } from '../repositories/search-index-respository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/code-queries');

export class CodeService extends DBService {
  codeRepository: CodeRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.codeRepository = new CodeRepository(connection);
  }

  /**
   * Function that fetches all code sets.
   *
   * @return {*}  {Promise<IAllCodeSets>} an object containing all code sets
   * @memberof CodeService
   */
  async getAllCodeSets(): Promise<IAllCodeSets> {
    defaultLog.debug({ message: 'getAllCodeSets' });

    const [feature_type_with_properties] = await Promise.all([await this.getFeatureTypePropertyCodes()]);

    return {
      feature_type_with_properties
    };
  }

  /**
   * Get all feature types.
   *
   * @return {*}  {Promise<FeatureTypeCode[]>}
   * @memberof CodeService
   */
  async getFeatureTypes(): Promise<FeatureTypeCode[]> {
    return this.codeRepository.getFeatureTypes();
  }

  /**
   * Get all feature properties grouped by feature type.
   *
   * @return {*}  {Promise<FeatureTypeWithFeaturePropertiesCode[]>}
   * @memberof CodeService
   */
  async getFeatureTypePropertyCodes(): Promise<FeatureTypeWithFeaturePropertiesCode[]> {
    defaultLog.debug({ message: 'getFeatureTypePropertyCodes' });

    const featureTypePropertyCodes = await this.codeRepository.getFeatureTypePropertyCodes();

    const groupedFeatureTypePropertyCodes: FeatureTypeWithFeaturePropertiesCode[] = [];

    // Iterate over the raw array of feature type property codes and group them by feature type
    for (const featureTypePropertyCode of featureTypePropertyCodes) {
      const index = groupedFeatureTypePropertyCodes.findIndex(
        (item) => item.feature_type.feature_type_id === featureTypePropertyCode.feature_type_id
      );

      const feature_type_properties = {
        feature_property_id: featureTypePropertyCode.feature_property_id,
        feature_property_name: featureTypePropertyCode.feature_property_name,
        feature_property_display_name: featureTypePropertyCode.feature_property_display_name,
        feature_property_type_id: featureTypePropertyCode.feature_property_type_id,
        feature_property_type_name: featureTypePropertyCode.feature_property_type_name
      };

      if (index >= 0) {
        groupedFeatureTypePropertyCodes[index].feature_type_properties.push(feature_type_properties);
      } else {
        groupedFeatureTypePropertyCodes.push({
          feature_type: {
            feature_type_id: featureTypePropertyCode.feature_type_id,
            feature_type_name: featureTypePropertyCode.feature_type_name,
            feature_type_display_name: featureTypePropertyCode.feature_type_display_name
          },
          feature_type_properties: [feature_type_properties]
        });
      }
    }

    return groupedFeatureTypePropertyCodes;
  }

  /**
   * Get a feature property record by name.
   *
   * @param {string} featurePropertyName
   * @return {*}  {Promise<FeaturePropertyRecord>}
   * @memberof CodeService
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeaturePropertyRecord> {
    defaultLog.debug({ message: 'getFeaturePropertyByName' });

    return this.codeRepository.getFeaturePropertyByName(featurePropertyName);
  }
}
