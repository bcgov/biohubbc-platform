import { IDBConnection } from '../database/db';
import { PostSubmissionFeature, PostSubmissionFeatureArraySchema } from '../models/submission-feature';
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
   * Recursively normalize submission features: lowercases the `type` of each feature.
   *
   * @param {unknown} submissionFeatures
   * @return {*}  {Promise<PostSubmissionFeature[]>} Returns the parsed and normalized array.
   * @memberof ValidationService
   */
  async normalizeSubmissionFeature(submissionFeatures: unknown): Promise<PostSubmissionFeature[]> {
    // Parse and validate first
    const parsedFeatures = PostSubmissionFeatureArraySchema.parse(submissionFeatures);

    // Helper to recursively lowercase `type`
    const normalizeFeature = (feature: PostSubmissionFeature): PostSubmissionFeature => {
      const normalized: PostSubmissionFeature = {
        ...feature,
        type: feature.type.toLowerCase(),
        child_features: feature.child_features?.map(normalizeFeature)
      };
      return normalized;
    };

    return parsedFeatures.map(normalizeFeature);
  }

  /**
   * Validate submission features array using the Zod model.
   *
   * @param {unknown} submissionFeatures
   * @return {*}  {Promise<PostSubmissionFeature[]>} Returns the parsed array if valid, throws otherwise.
   * @memberof ValidationService
   */
  async validateSubmissionFeatureShape(submissionFeatures: unknown): Promise<PostSubmissionFeature[]> {
    return PostSubmissionFeatureArraySchema.parse(submissionFeatures); // throws if invalid
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
          if (typeof dataProperty !== 'object') {
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
