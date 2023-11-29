import traverse from 'json-schema-traverse';
import { IDBConnection } from '../database/db';
import { IDatasetSubmission } from '../repositories/submission-repository';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { IMediaState } from '../utils/media/media-file';
import { ValidationSchemaParser } from '../utils/media/validation/validation-schema-parser';
import { DBService } from './db-service';

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
  }

  /**
   * Validate dataset submission
   *
   * @param {IDatasetSubmission} dataset
   * @return {*}  {Promise<boolean>}
   * @memberof ValidationService
   */
  async validateDatasetSubmission(dataset: IDatasetSubmission): Promise<boolean> {
    const traverseCallBack = (dataset: any) => {
      if (dataset.id === undefined) {
        throw new Error('Invalid dataset submission: missing id');
      }
      if (dataset.type === undefined) {
        throw new Error('Invalid dataset submission: missing type');
      }
      if (dataset.properties === undefined) {
        throw new Error('Invalid dataset submission: missing properties');
      }

      if (typeof dataset.id !== 'string') {
        throw new Error('Invalid dataset submission: id must be a string');
      }
      if (typeof dataset.type !== 'string') {
        throw new Error('Invalid dataset submission: type must be a string');
      }
      if (typeof dataset.properties !== 'object') {
        throw new Error('Invalid dataset submission: properties must be an object');
      }

      if (dataset.features) {
        if (!Array.isArray(dataset.features)) {
          throw new Error('Invalid dataset submission: features must be an array');
        }
        dataset.features.forEach((feature: any) => {
          traverseCallBack(feature);
        });
      }
    };

    traverse(dataset, (data: any) => {
      if (data.features === undefined) {
        throw new Error('Invalid dataset submission: missing features');
      }
      traverseCallBack(data);
    });

    return true;
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
