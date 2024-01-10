import { JSONPath } from 'jsonpath-plus';
import { IDBConnection } from '../database/db';
import { ISubmissionFeature } from '../repositories/submission-repository';
import {
  IFeatureProperties,
  IInsertStyleSchema,
  IStyleModel,
  ValidationRepository
} from '../repositories/validation-repository';
import { getLogger } from '../utils/logger';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { IMediaState } from '../utils/media/media-file';
import { ValidationSchemaParser } from '../utils/media/validation/validation-schema-parser';
import { GeoJSONFeatureCollectionZodSchema } from '../zod-schema/geoJsonZodSchema';
import { DBService } from './db-service';

const defaultLog = getLogger('services/validation-service');

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;
  validationPropertiesCache: Map<string, IFeatureProperties[]>;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
    this.validationPropertiesCache = new Map<string, IFeatureProperties[]>();
  }

  /**
   * Validate submission features.
   *
   * @param {ISubmissionFeature[]} submissionFeatures
   * @return {*}  {Promise<boolean>}
   * @memberof ValidationService
   */
  async validateSubmissionFeatures(submissionFeatures: ISubmissionFeature[]): Promise<boolean> {
    // Generate paths to all non-null nodes which contain a 'features' property, ignoring the 'properties' field
    const allFeaturesPaths: string[] = JSONPath({
      path: "$..[?(@ && @parentProperty != 'properties' && @.features)]",
      flatten: true,
      resultType: 'path',
      json: submissionFeatures
    });

    try {
      for (const path of allFeaturesPaths) {
        // Fetch a submissionFeature object
        const node: ISubmissionFeature[] = JSONPath({ path: path, resultType: 'value', json: submissionFeatures });

        if (!node?.length) {
          continue;
        }

        // We expect the 'path' to resolve an array of 1 item
        const nodeWithoutFeatures = { ...node[0], features: [] };

        // Validate the submissioNFeature object
        await this.validateSubmissionFeature(nodeWithoutFeatures);
      }
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
   * @param {IFeatureProperties[]} properties
   * @param {*} dataProperties
   * @return {*}  {boolean} `true` if the submission feature is valid, `false` otherwise.
   * @memberof ValidationService
   */
  validateProperties(properties: IFeatureProperties[], dataProperties: any): boolean {
    defaultLog.debug({ label: 'validateProperties', message: 'params', properties, dataProperties });

    const throwPropertyError = (property: IFeatureProperties) => {
      throw new Error(`Property ${property.name} is not of type ${property.type}`);
    };

    for (const property of properties) {
      const dataProperty = dataProperties[property.name];

      if (!dataProperty) {
        throw new Error(`Property [${property.name}] not found in data`);
      }

      switch (property.type) {
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

  async getFeatureValidationProperties(featureType: string): Promise<IFeatureProperties[]> {
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

  /**
   * Validate DWCArchive file with given stylesheet
   *
   * @param {DWCArchive} dwcArchive
   * @param {IStyleModel} styleSchema
   * @return {*}  {{ validation: boolean; mediaState: IMediaState; csvState?: ICsvState[] }}
   * @memberof ValidationService
   */
  validateDWCArchiveWithStyleSchema(
    dwcArchive: DWCArchive,
    styleSchema: IStyleModel
  ): { validation: boolean; mediaState: IMediaState; csvState?: ICsvState[] } {
    const validationSchemaParser: ValidationSchemaParser = new ValidationSchemaParser(styleSchema);

    const mediaState: IMediaState = dwcArchive.isMediaValid(validationSchemaParser);

    if (!mediaState.isValid) {
      return { validation: false, mediaState: mediaState };
    }

    const csvState: ICsvState[] = dwcArchive.isContentValid(validationSchemaParser);

    return { validation: true, mediaState: mediaState, csvState: csvState };
  }
}
