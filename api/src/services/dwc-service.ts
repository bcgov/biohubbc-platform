import { ApiGeneralError } from '../errors/api-error';
import { getFileFromS3 } from '../utils/file-utils';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { OccurrenceService } from './occurrence-service';
import { SubmissionService } from './submission-service';

export class DarwinCoreService extends DBService {
  async scrapeAndUploadOccurences(submissionId: number): Promise<{ occurrence_id: number }[]> {
    const submissionService = new SubmissionService(this.connection);
    const occurrenceService = new OccurrenceService(this.connection);

    const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord.input_key) {
      throw new ApiGeneralError('s3Key for submission unavailable');
    }

    const s3File = await getFileFromS3(submissionRecord.input_key);

    const dwcArchive: DWCArchive = await this.prepDWCArchive(s3File);

    return await occurrenceService.scrapeAndUploadOccurrences(submissionId, dwcArchive);
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
      throw new ApiGeneralError('Failed to parse submission, not a valid DwC Archive Zip file');
    }

    return new DWCArchive(parsedMedia);
  }
}
