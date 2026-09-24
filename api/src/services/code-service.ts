import { IDBConnection } from '../database/db';
import { IAllCodeSets } from '../models/codes';
import { FeatureType, FeatureTypeWithProperties, FeatureTypeWithPropertyDefinitions } from '../models/feature-type';
import { BlueprintRepository } from '../repositories/blueprint-repository';
import { CodeRepository } from '../repositories/code-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/code-queries');

export class CodeService extends DBService {
  codeRepository: CodeRepository;
  blueprintRepository: BlueprintRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.codeRepository = new CodeRepository(connection);
    this.blueprintRepository = new BlueprintRepository(connection);
  }

  /**
   * Function that fetches all code sets.
   *
   * The feature type properties are the active default Blueprint's configuration, since the code
   * sets describe how new data is composed.
   *
   * @return {*}  {Promise<IAllCodeSets>} an object containing all code sets
   * @memberof CodeService
   */
  async getAllCodeSets(): Promise<IAllCodeSets> {
    defaultLog.debug({ message: 'getAllCodeSets' });

    return {
      feature_type_with_properties: await this.getFeatureTypePropertiesForDefaultBlueprint()
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
   * Get every active feature type with the active default Blueprint's assignments.
   *
   * When no active default Blueprint exists, every feature type is returned with no properties.
   *
   * @return {*}  {Promise<FeatureTypeWithProperties[]>}
   * @memberof CodeService
   */
  async getFeatureTypePropertiesForDefaultBlueprint(): Promise<FeatureTypeWithProperties[]> {
    defaultLog.debug({ message: 'getFeatureTypePropertiesForDefaultBlueprint' });

    const defaultBlueprintId = await this.blueprintRepository.findDefaultBlueprintId();

    if (defaultBlueprintId === null) {
      const featureTypes = await this.codeRepository.getFeatureTypes();

      return featureTypes.map((featureType) => ({ feature_type: featureType, properties: [] }));
    }

    return this.codeRepository.getFeatureTypePropertiesByBlueprintId(defaultBlueprintId);
  }

  /**
   * Get every active feature type with every property ever assigned to it, under any Blueprint at any
   * lifecycle. This is the Blueprint-independent description of what stored values can carry.
   *
   * @return {*}  {Promise<FeatureTypeWithPropertyDefinitions[]>}
   * @memberof CodeService
   */
  async getFeatureTypeProperties(): Promise<FeatureTypeWithPropertyDefinitions[]> {
    defaultLog.debug({ message: 'getFeatureTypeProperties' });

    return this.codeRepository.getFeatureTypeProperties();
  }
}
