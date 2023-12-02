import traverse from 'json-schema-traverse';
import { JSONPath } from 'jsonpath-plus';
import { IDBConnection } from '../database/db';
import { BioHubDataSubmission } from '../openapi/schemas/biohub-data-submission';
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
    const validateProperty = (data: any, property: string | number, type: string) => {
      console.log('data', data);
      console.log('property', property);
      console.log('type', type);

      const jsonData = data[0][property];
      if (property === 'features' && jsonData === undefined) {
        return;
      }

      console.log(`---Validation of ${jsonData} as ${type}---`);

      // check if jsonData is an array
      if (type === 'array') {
        if (!Array.isArray(jsonData)) {
          throw new Error(`Invalid dataset submission: ${jsonData} must be a ${type}`);
        }

        jsonData.forEach((element: any) => {
          this.validateDatasetSubmission(element);
        });

        return;
      }

      // check if type of jsonData is the same as the type in the schema
      if (typeof jsonData !== type) {
        throw new Error(`Invalid dataset submission: ${jsonData} must be a ${type}`);
      }

      // check if jsonData is a valid enum value
      // update this to use the enum values from the schema
      if (property === 'type' && !['dataset', 'observation'].includes(jsonData)) {
        throw new Error(`Invalid dataset submission: ${jsonData} must be a dataset`);
      }
    };

    const validationCallback = (
      schema: traverse.SchemaObject,
      json_pointer: string,
      rootSchema: traverse.SchemaObject,
      parentJsonPtr: string | undefined,
      parentKeyword: string | undefined,
      parentSchema: traverse.SchemaObject | undefined,
      property: string | number | undefined
    ) => {
      // parent catches the root object
      if (parentJsonPtr === undefined || parentKeyword === 'items') {
        return;
      }

      // strip off the leading slash and properties
      if (parentKeyword === 'properties') {
        parentJsonPtr = parentJsonPtr.replace('/properties', '');
      }

      if (parentJsonPtr === 'features') {
        parentJsonPtr += '.*';
      }

      const jsonData = JSONPath({ path: `$.${parentJsonPtr}`, json: dataset });
      if (jsonData.length === 0 || jsonData[0] === undefined || !property) {
        return;
      }

      validateProperty(jsonData, property, schema.type);
    };

    traverse(BioHubDataSubmission, validationCallback);

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
