import { IDBConnection } from '../database/db';
import { IAllCodeSets } from '../models/codes';
import { FeatureType, FeatureTypeWithProperties } from '../models/feature-type';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { CodeRepository } from '../repositories/code-repository';
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
   * @return {*}  {Promise<FeatureType[]>}
   * @memberof CodeService
   */
  async getFeatureTypes(): Promise<FeatureType[]> {
    return this.codeRepository.getFeatureTypes();
  }

  /**
   * Get all feature properties grouped by feature type.
   *
   * @return {*}  {Promise<FeatureTypeWithProperties[]>}
   * @memberof CodeService
   */
  async getFeatureTypePropertyCodes(): Promise<FeatureTypeWithProperties[]> {
    defaultLog.debug({ message: 'getFeatureTypePropertyCodes' });

    return this.codeRepository.getFeatureTypePropertyCodes();
  }

  /**
   * Get a feature property record by name.
   *
   * @param {string} featurePropertyName
   * @return {*}  {Promise<FeatureTypeProperty>}
   * @memberof CodeService
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeatureTypeProperty> {
    defaultLog.debug({ message: 'getFeaturePropertyByName' });

    return this.codeRepository.getFeaturePropertyByName(featurePropertyName);
  }
}
