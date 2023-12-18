import { IDBConnection } from '../database/db';
import { CodeRepository, IAllCodeSets } from '../repositories/code-repository';
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

    const [feature_types, feature_type_with_properties] = await Promise.all([
      await this.codeRepository.getFeatureTypes(),
      await this.getFeatureTypeProperties()
    ]);

    return {
      feature_types,
      feature_type_with_properties
    };
  }

  /**
   * Function that fetches all feature type properties.
   *
   * @return {*}  {Promise<any>}
   * @memberof CodeService
   */
  async getFeatureTypeProperties(): Promise<any> {
    defaultLog.debug({ message: 'getFeatureTypes' });

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
}
