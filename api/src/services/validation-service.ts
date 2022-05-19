import { IDBConnection } from '../database/db';
import { DBService } from './db-service';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { ValidationSchemaParser } from '../utils/media/validation/validation-schema-parser';
import { IMediaState } from '../utils/media/media-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ICsvState } from '../utils/media/csv/csv-file';

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
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
