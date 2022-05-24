import { v4 as uuid4 } from 'uuid';
import { ES_INDEX } from '../constants/database';
import { ApiGeneralError } from '../errors/api-error';
import { SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateS3FileKey, getFileFromS3, uploadFileToS3 } from '../utils/file-utils';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { OccurrenceService } from './occurrence-service';
import { SubmissionService } from './submission-service';
import { ESService } from '../services/es-service';
import { XmlString } from 'aws-sdk/clients/applicationautoscaling';

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

    const dwcArchive: DWCArchive = this.prepDWCArchive(s3File);

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
    const dataPackageId = options?.dataPackageId || uuid4();
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

    // await call the function

    await uploadFileToS3(file, s3Key, {
      filename: file.originalname
    });

    return { dataPackageId, submissionId };
  }

  async transformAndUploadMetaData(submissionId: number, dataPackageId: string) {
    const submissionService = new SubmissionService(this.connection);

    const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord || !submissionRecord.eml_source) {
      throw new ApiGeneralError('eml source is not available');
    }

    const esClient = await new ESService().getEsClient();
    const jsonDoc = this.convertEMLtoJSON(submissionRecord.eml_source);

    await esClient.create({ id: dataPackageId, index: ES_INDEX.EML, document: jsonDoc });

    //TODO: We need a new submission status type
    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);
  }

  async convertEMLtoJSON(emlSource: XmlString) {
    if (!emlSource) {
      return;
    }
    const jsonDoc = {
      datasetName: 'Coastal Caribou',
      publishDate: '2021-08-05',
      projects: [
        {
          projectId: '78ba2b5d-252b-46dc-909f-e634aa26a402',
          projectName: 'West Coast',
          projectObjectives:
            'The new Common Terms Query is designed to fix this situations, and it does so through a very clever mechanism. At a high level, Common Terms analyzes your query, identifies which words are important and performs a search using just those words. Only after documents are matched with important words are the unimportant words considered.',
          fundingSource: 'Together for Wildlife'
        },
        {
          projectId: 'd26547a9-31f3-4477-9ca4-e8a8e7edc237',
          projectName: 'North West Coast',
          projectObjectives:
            'With traditional stop word schemes, you must first create a list of stop words. Every domain is unique when it comes to stop words: there are no pre-made stop word lists on the internet. As an example, consider the word video. For most businesses, video is an important word – it shouldn’t be removed. But if you are Youtube, video is probably mentioned in thousands of places…it is definitely a stop word in this context. Traditional stop word removal would need a human to sit down, compile a list of domain-specific stop words, add it to Elasticsearch and then routinely maintain the list with additions/deletions.',
          fundingSource: 'Together for Wildlife'
        },
        {
          projectId: 'd26547a9-31f3-4477-9ca4-e8a8e7edc236',
          projectName: 'South West Coast',
          projectObjectives:
            "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer Or to take arms against a sea of troubles The slings and arrows of outrageous fortune, And by opposing end them. To die—to sleep, No more; and by a sleep to say we end The heart-ache and the thousand natural shocks That flesh is heir to: 'tis a consummation Devoutly to be wish'd. To die, to sleep; To sleep, perchance to dream—ay, there's the rub: For in that sleep of death what dreams may come, When we have shuffled off this mortal coil, Must give us pause—there's the respect That makes calamity of so long life. For who would bear the whips and scorns of time, Th'oppressor's wrong, the proud man's contumely, The pangs of dispriz'd love, the law's delay, The insolence of office, and the spurns",
          fundingSource: 'Some Funding'
        }
      ]
    };

    return jsonDoc;
  }
}
