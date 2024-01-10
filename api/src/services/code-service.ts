import { IDBConnection } from '../database/db';
import { CodeRepository, FeatureTypeWithFeaturePropertiesCode, IAllCodeSets } from '../repositories/code-repository';
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

    const [feature_type_with_properties] = await Promise.all([await this.getFeatureTypeProperties()]);

    return {
      feature_type_with_properties
    };
  }

  /**
   * Function that fetches all feature type properties.
   *
   * @return {*}  {Promise<FeatureTypeWithFeaturePropertiesCode[]>}
   * @memberof CodeService
   */
  async getFeatureTypeProperties(): Promise<FeatureTypeWithFeaturePropertiesCode[]> {
    defaultLog.debug({ message: 'getFeatureTypeProperties' });

    const feature_types = await this.codeRepository.getFeatureTypes();

    const feature_type_with_properties = await Promise.all(
      feature_types.map(async (feature_type) => {
        const feature_type_properties = await this.codeRepository.getFeatureTypeProperties(feature_type.id);

        return {
          feature_type,
          feature_type_properties
        };
      })
    );

    return feature_type_with_properties;
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
