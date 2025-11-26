import { JSONPath } from 'jsonpath-plus';
import { IDBConnection } from '../database/db';
import { ISubmissionFeature } from '../repositories/submission-repository';
import {
  FeatureProperties,
  IInsertStyleSchema,
  IStyleModel,
  ValidationRepository
} from '../repositories/validation-repository';
import { getLogger } from '../utils/logger';
import { GeoJSONFeatureCollectionZodSchema } from '../zod-schema/geoJsonZodSchema';
import { DBService } from './db-service';

const defaultLog = getLogger('services/validation-service');

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;
  validationPropertiesCache: Map<string, FeatureProperties[]>;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
    this.validationPropertiesCache = new Map<string, FeatureProperties[]>();
  }

  /**
   * Validate submission features.
   *
   * @param {ISubmissionFeature[]} submissionFeatures
   * @return {*}  {Promise<boolean>} `true` if all submission features are valid, `false` otherwise.
   * @memberof ValidationService
   */
  async validateSubmissionFeatures(submissionFeatures: ISubmissionFeature[]): Promise<boolean> {
    try {
      // Generate paths to all non-null nodes which contain a 'child_features' property
      const submissionFeatureJsonPaths: string[] = JSONPath({
        path: '$..[?(@ && @.child_features)]',
        flatten: true,
        resultType: 'path',
        json: submissionFeatures
      });

      for (const jsonPath of submissionFeatureJsonPaths) {
        // Fetch a submissionFeature object
        const node: ISubmissionFeature[] = JSONPath({ path: jsonPath, resultType: 'value', json: submissionFeatures });

        if (!node?.length) {
          continue;
        }

        // We expect the 'path' to resolve an array of 1 item
        const featureNode = node[0];

        // Validate the submissioNFeature object
        await this.validateSubmissionFeature(featureNode);
      }

      defaultLog.debug({ label: 'validateSubmissionFeatures', message: 'success' });
    } catch (error) {
      defaultLog.error({ label: 'validateSubmissionFeatures', message: 'error', error });
      // Not all submission features are valid
      return false;
    }

    // All submission features are valid
    return true;
  }

  /**
   * Validate a submission feature (not including its child features).
   *
   * @param {ISubmissionFeature} submissionFeature
   * @return {*}  {Promise<boolean>}
   * @memberof ValidationService
   */
  async validateSubmissionFeature(submissionFeature: ISubmissionFeature): Promise<boolean> {
    const validationProperties = await this.getFeatureValidationProperties(submissionFeature.type);
    return this.validateProperties(validationProperties, submissionFeature.properties);
  }

  /**
   * Validate the properties of a submission feature.
   *
   * @param {FeatureProperties[]} properties The known/recognized properties of a feature type.
   * @param {ISubmissionFeature['properties']} dataProperties The raw/original properties of a submission feature.
   * @return {*}  {boolean} `true` if the submission feature is valid, `false` otherwise.
   * @memberof ValidationService
   */
  validateProperties(properties: FeatureProperties[], dataProperties: ISubmissionFeature['properties']): boolean {
    defaultLog.debug({ label: 'validateProperties', message: 'params', properties, dataProperties });

    const throwPropertyError = (property: FeatureProperties) => {
      throw new Error(`Property ${property.name} is not of type ${property.type_name}`);
    };

    for (const property of properties) {
      const dataProperty = dataProperties[property.name];

      if (dataProperty === undefined || dataProperty === null) {
        if (property.required_value) {
          // Property is required and is null or undefined. Fail validation.
          throw new Error(`Property ${property.name} is required but is null or undefined`);
        }
        // Property is optional is null or undefined. Skip further validation.
        continue;
      }

      switch (property.type_name) {
        case 'string':
          if (typeof dataProperty !== 'string') {
            throwPropertyError(property);
          }
          break;
        case 'number':
          if (typeof dataProperty !== 'number') {
            throwPropertyError(property);
          }
          break;
        case 'boolean':
          if (typeof dataProperty !== 'boolean') {
            throwPropertyError(property);
          }
          break;
        case 'object':
          if (typeof dataProperty !== 'object' || Array.isArray(dataProperty)) {
            throwPropertyError(property);
          }
          break;
        case 'array':
          if (!Array.isArray(dataProperty)) {
            throwPropertyError(property);
          }
          break;
        case 'spatial': {
          const { success } = GeoJSONFeatureCollectionZodSchema.safeParse(dataProperty);
          if (!success) {
            throwPropertyError(property);
          }
          break;
        }
        case 'datetime': {
          if (typeof dataProperty !== 'string') {
            throwPropertyError(property);
            break;
          }

          const date = new Date(dataProperty);

          if (date.toString() === 'Invalid Date') {
            throw new Error(`Property ${property.name} is not a valid date`);
          }
          break;
        }
        default:
          throw new Error(`Property ${property.name} has an invalid type`);
      }
    }

    return true;
  }

  async getFeatureValidationProperties(featureType: string): Promise<FeatureProperties[]> {
    let properties = this.validationPropertiesCache.get(featureType);

    if (!properties) {
      properties = await this.validationRepository.getFeatureValidationProperties(featureType);

      this.validationPropertiesCache.set(featureType, properties);
    }

    return properties;
  }

  /**
   * Insert Style sheet into db
   *
   * @param {IInsertStyleSchema} styleSchema
   * @return {*}  {Promise<{ style_id: number }>}
   * @memberof ValidationService
   */
  async insertStyleSchema(styleSchema: IInsertStyleSchema): Promise<{ style_id: number }> {
    return this.validationRepository.insertStyleSchema(styleSchema);
  }

  /**
   * Get Style sheet from db with given id
   *
   * @param {number} styleId
   * @return {*}  {Promise<IStyleModel>}
   * @memberof ValidationService
   */
  async getStyleSchemaByStyleId(styleId: number): Promise<IStyleModel> {
    return this.validationRepository.getStyleSchemaByStyleId(styleId);
  }
}
