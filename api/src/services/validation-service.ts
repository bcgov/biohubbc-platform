import { IDBConnection } from '../database/db';
import { DBService } from './db-service';
import { IInsertStyleSchema, IStyleModel, ValidationRepository } from '../repositories/validation-repository';
import { ValidationSchemaParser } from '../utils/media/validation/validation-schema-parser';
import { IMediaState } from '../utils/media/media-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ICsvState } from '../utils/media/csv/csv-file';
import { SubmissionService } from './submission-service';
import { SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);
  }

  async insertStyleSchema(styleSchema: IInsertStyleSchema): Promise<{ style_id: number }> {
    return this.validationRepository.insertStyleSchema(styleSchema);
  }

  async getStyleSchemaByStyleId(styleId: number): Promise<IStyleModel> {
    return this.validationRepository.getStyleSchemaByStyleId(styleId);
  }

  async validateDWCArchiveWithStyleSchema(
    submissionId: number,
    dwcArchive: DWCArchive,
    styleSchema: IStyleModel
  ): Promise<{ validation: boolean; mediaState: IMediaState; csvState?: ICsvState[] }> {
    const submissionService = new SubmissionService(this.connection);

    const validationSchemaParser: ValidationSchemaParser = new ValidationSchemaParser(styleSchema);

    const mediaState: IMediaState = dwcArchive.isMediaValid(validationSchemaParser);

    if (!mediaState.isValid) {
      await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.REJECTED);
      return { validation: false, mediaState: mediaState };
    }

    const csvState: ICsvState[] = dwcArchive.isContentValid(validationSchemaParser);

    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);
    return { validation: true, mediaState: mediaState, csvState: csvState };
  }
}
