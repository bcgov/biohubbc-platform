import { IDBConnection } from '../database/db';
import { IDatasetSubmission } from '../repositories/submission-repository';
import {
  IFeatureProperties,
  IInsertStyleSchema,
  IStyleModel,
  ValidationRepository
} from '../repositories/validation-repository';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { IMediaState } from '../utils/media/media-file';
import { ValidationSchemaParser } from '../utils/media/validation/validation-schema-parser';
import { DBService } from './db-service';

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;
  validationProperties: Map<string, IFeatureProperties[]>;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
    this.validationProperties = new Map<string, IFeatureProperties[]>();
  }

  /**
   * Validate dataset submission
   *
   * @param {IDatasetSubmission} dataset
   * @return {*}  {Promise<boolean>}
   * @memberof ValidationService
   */
  async validateDatasetSubmission(dataset: IDatasetSubmission): Promise<boolean> {
    // validate dataset.type is 'dataset'
    const datasetFeatureType = dataset.type;

    // get dataset validation properties
    const datasetValidationProperties = await this.getFeatureValidationProperties(datasetFeatureType);

    // get features in dataset
    const features = dataset.features;

    try {
      // validate dataset properties
      await this.validateProperties(datasetValidationProperties, dataset.properties);

      // validate features
      for (const feature of features) {
        const featureType = feature.type;

        // get feature validation properties
        const featureValidationProperties = await this.getFeatureValidationProperties(featureType);

        // validate feature properties
        await this.validateProperties(featureValidationProperties, feature.properties);
      }
    } catch (e) {
      console.log(e);
      return false;
    }
    return true;
  }

  async validateProperties(properties: IFeatureProperties[], dataProperties: any): Promise<boolean> {
    const throwPropertyError = (property: IFeatureProperties) => {
      throw new Error(`Property ${property.name} is not of type ${property.type}`);
    };

    for (const property of properties) {
      const dataProperty = dataProperties[property.name];

      if (!dataProperty) {
        throw new Error(`Property ${property.name} not found in data`);
      }

      if (property.type === 'string') {
        if (typeof dataProperty !== 'string') {
          throwPropertyError(property);
        }
      } else if (property.type === 'number') {
        if (typeof dataProperty !== 'number') {
          throwPropertyError(property);
        }
      } else if (property.type === 'boolean') {
        if (typeof dataProperty !== 'boolean') {
          throwPropertyError(property);
        }
      } else if (property.type === 'object') {
        if (typeof dataProperty !== 'object') {
          throwPropertyError(property);
        }
      } else if (property.type === 'spatial') {
        if (Array.isArray(dataProperty) === false) {
          throwPropertyError(property);
        }
      } else if (property.type === 'datetime') {
        if (typeof dataProperty !== 'string') {
          throwPropertyError(property);
        }

        const date = new Date(dataProperty);

        if (date.toString() === 'Invalid Date') {
          throw new Error(`Property ${property.name} is not a valid date`);
        }
      } else {
        throw new Error(`Property ${property.name} has an invalid type`);
      }
    }

    return true;
  }

  async getFeatureValidationProperties(featureType: string): Promise<IFeatureProperties[]> {
    if (this.validationProperties.get(featureType) === undefined) {
      this.validationProperties.set(
        featureType,
        await this.validationRepository.getFeatureValidationProperties(featureType)
      );
    }

    return this.validationProperties.get(featureType) as IFeatureProperties[];
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
