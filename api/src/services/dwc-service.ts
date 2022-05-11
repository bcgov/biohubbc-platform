import { v4 as uuidv4 } from 'uuid';
import { ApiGeneralError } from '../errors/api-error';
import { SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateS3FileKey, getFileFromS3, uploadFileToS3 } from '../utils/file-utils';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { OccurrenceService } from './occurrence-service';
import { SubmissionService } from './submission-service';

export class DarwinCoreService extends DBService {
  async scrapeAndUploadOccurrences(submissionId: number): Promise<{ occurrence_id: number }[]> {
    const submissionService = new SubmissionService(this.connection);

    const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord || !submissionRecord.input_key) {
      throw new ApiGeneralError('s3Key submissionRecord unavailable');
    }

    const s3File = await getFileFromS3(submissionRecord.input_key);

    if (!s3File) {
      throw new ApiGeneralError('s3File unavailable');
    }

    const dwcArchive: DWCArchive = await this.prepDWCArchive(s3File);

    const occurrenceService = new OccurrenceService(this.connection);

    const response = await occurrenceService.scrapeAndUploadOccurrences(submissionId, dwcArchive);

    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);

    return response;
  }

  /**
   * Parse unknown submission file and convert to DWArchive file.
   *
   * @param {UnknownMedia} unknownMedia
   * @return {*}  {DWCArchive}
   * @memberof DarwinCoreService
   */
  prepDWCArchive(unknownMedia: UnknownMedia): DWCArchive {
    const parsedMedia = parseUnknownMedia(unknownMedia);

    if (!parsedMedia) {
      throw new ApiGeneralError('Failed to parse submission, file was empty');
    }

    if (!(parsedMedia instanceof ArchiveFile)) {
      throw new ApiGeneralError('Failed to parse submission, not a valid Archive file');
    }

    return new DWCArchive(parsedMedia);
  }

  /**
   * Ingest a Darwin Core Archive (DwCA) data package.
   *
   * @param {Express.Multer.File} file
   * @param {{ dataPackageId?: string }} [options] A globally unique id. Will default to a random uuid if not supplied.
   * @return {*}  {Promise<{ dataPackageId: string; submissionId: number }>}
   * @memberof DarwinCoreService
   */
  async ingestNewDwCADataPackage(
    file: Express.Multer.File,
    options?: { dataPackageId?: string; source?: string }
  ): Promise<{ dataPackageId: string; submissionId: number }> {
    const dataPackageId = options?.dataPackageId || uuidv4();
    const source = options?.source || 'SIMS'; // TODO Parse from the provided EML file?

    // TODO Check if `dataPackageId` already exists? If so, update or throw error?

    const dwcArchive = this.prepDWCArchive(file);

    const submissionService = new SubmissionService(this.connection);

    const response = await submissionService.insertSubmissionRecord({
      source: source,
      input_file_name: dwcArchive.rawFile.fileName,
      input_key: '',
      event_timestamp: new Date().toISOString(),
      eml_source: dwcArchive.extra.eml,
      darwin_core_source: '{}', // TODO populate
      uuid: dataPackageId
    });

    if (!response || !response.submission_id) {
      throw new ApiGeneralError('Failed to insert submission record', [
        `submissionId was null or undefined: ${response}`
      ]);
    }

    const submissionId = response.submission_id;

    const s3Key = generateS3FileKey({
      submissionId: submissionId,
      fileName: file.originalname
    });

    await submissionService.updateSubmissionRecordInputKey(submissionId, s3Key);

    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMITTED);

    await uploadFileToS3(file, s3Key, {
      filename: file.originalname
    });

    return { dataPackageId, submissionId };
  }
}
