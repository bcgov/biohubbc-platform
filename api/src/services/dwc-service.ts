import { XmlString } from 'aws-sdk/clients/applicationautoscaling';
import SaxonJS2N from 'saxon-js';
import { v4 as uuidv4 } from 'uuid';
import { ES_INDEX } from '../constants/database';
import { ApiGeneralError } from '../errors/api-error';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateS3FileKey, getFileFromS3, uploadFileToS3 } from '../utils/file-utils';
import { parseS3File } from '../utils/media-utils';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { OccurrenceService } from './occurrence-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

export class DarwinCoreService extends DBService {
  /**
   * Parse submission record to DWCArchive file
   *
   * @param {number} submissionId
   * @return {*}  {Promise<DWCArchive>}
   * @memberof DarwinCoreService
   */
  async getSubmissionRecordAndConvertToDWCArchive(submissionId: number): Promise<DWCArchive> {
    const submissionService = new SubmissionService(this.connection);

    const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord || !submissionRecord.input_key) {
      throw new ApiGeneralError('submission record s3Key unavailable', [
        'DarwinCoreService->getSubmissionRecordAndConvertToDWCArchive',
        'submission record was invalid or did not contain input_key'
      ]);
    }

    const s3File = await getFileFromS3(submissionRecord.input_key);

    if (!s3File) {
      throw new ApiGeneralError('s3 file unavailable', [
        'DarwinCoreService->getSubmissionRecordAndConvertToDWCArchive',
        's3 file is invalid or unavailable'
      ]);
    }

    return this.prepDWCArchive(s3File);
  }

  /**
   * Scrape occurrences from submissionFile and upload to table
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ occurrence_id: number }[]>}
   * @memberof DarwinCoreService
   */
  async scrapeAndUploadOccurrences(submissionId: number): Promise<{ occurrence_id: number }[]> {
    const dwcArchive: DWCArchive = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);

    const occurrenceService = new OccurrenceService(this.connection);

    const response = await occurrenceService.scrapeAndUploadOccurrences(submissionId, dwcArchive);

    const submissionService = new SubmissionService(this.connection);

    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);

    return response;
  }

  /**
   * Parse unknown submission record and convert to DWArchive file.
   *
   * @param {UnknownMedia} unknownMedia
   * @return {*}  {DWCArchive}
   * @memberof DarwinCoreService
   */
  prepDWCArchive(unknownMedia: UnknownMedia): DWCArchive {
    const parsedMedia = parseUnknownMedia(unknownMedia);

    if (!parsedMedia) {
      throw new ApiGeneralError('Failed to parse submission', [
        'DarwinCoreService->prepDWCArchive',
        'unknown media file was empty or unable to be parsed'
      ]);
    }

    if (!(parsedMedia instanceof ArchiveFile)) {
      throw new ApiGeneralError('Failed to parse submission', [
        'DarwinCoreService->prepDWCArchive',
        'unknown media file was not a valid Archive file'
      ]);
    }

    return new DWCArchive(parsedMedia);
  }

  /**
   * Ingest a Darwin Core Archive (DwCA) data package.
   *
   * @param {Express.Multer.File} file
   * @param {{ dataPackageId?: string }} [options]
   * @return {*}  {Promise<{ dataPackageId: string; submissionId: number }>}
   * @memberof DarwinCoreService
   */
  async ingestNewDwCADataPackage(
    file: Express.Multer.File,
    options?: { dataPackageId?: string }
  ): Promise<{ dataPackageId: string; submissionId: number }> {
    const dataPackageId = options?.dataPackageId || uuidv4();

    // TODO Check if `dataPackageId` already exists? If so, update existing record or throw error?

    const dwcArchive = this.prepDWCArchive(file);

    const submissionService = new SubmissionService(this.connection);

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    const response = await submissionService.insertSubmissionRecord({
      source_transform_id: sourceTransformRecord.source_transform_id,
      input_file_name: dwcArchive.rawFile.fileName,
      input_key: '',
      event_timestamp: new Date().toISOString(),
      eml_source: dwcArchive.extra.eml?.buffer?.toString() || '',
      darwin_core_source: '{}', // TODO populate
      uuid: dataPackageId
    });

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

  /**
   * transform submission record eml to json and upload metadata
   *
   * @param {number} submissionId
   * @param {string} dataPackageId
   * @return {*}  {Promise<WriteResponseBase>}
   * @memberof DarwinCoreService
   */
  async transformAndUploadMetaData(submissionId: number, dataPackageId: string): Promise<any> {
    const submissionService = new SubmissionService(this.connection);

    const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    console.log('submissionRecord is: ', submissionRecord);

    if (!submissionRecord.eml_source) {
      throw new ApiGeneralError('The eml source is not available');
    }

    const stylesheetfromS3 = await submissionService.getStylesheetFromS3(submissionId);

    console.log('1- got here');

    if (!stylesheetfromS3) {
      throw new ApiGeneralError('The transformation stylesheet is not available');
    }
    console.log('2- got here');

    const parsedStylesheet = parseS3File(stylesheetfromS3);
    console.log('3- got here');
    console.log('parsedStylesheet is: ', parsedStylesheet);

    if (!parsedStylesheet) {
      throw new ApiGeneralError('Failed to parse the stylesheet');
    }
    console.log('4- got here');

    const compiledTemplate = parsedStylesheet.buffer.toString();

    console.log('5- got here');

    console.log('compiledTemplate is ', compiledTemplate);

    let transformedEML;
    let response;

    //call to the SaxonJS library to transform out EML into a JSON structure using XSLT stylesheets
    try {
      transformedEML = await this.transformEMLtoJSON(submissionRecord.eml_source, compiledTemplate);

      console.log('6 - got here');
      console.log('transformedEML is', transformedEML);
    } catch (error) {
      console.log('7 - got here: error state');
      return submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'eml transformation failed'
      );
    }

    //call to the ElasticSearch API to create a record with our transformed EML
    try {
      console.log('8 - got here');
      response = await this.uploadtoElasticSearch(dataPackageId, transformedEML);
      console.log('9 - got here');
      console.log('response from ES : ', response);
    } catch (error) {
      return submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'upload to elastic search failed'
      );
    }

    console.log('10 - got here');

    //TODO: We need a new submission status type
    const response2 = await submissionService.insertSubmissionStatus(
      submissionId,
      SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED
    );
    console.log('response from insert submission status ', response2);
    return response2;
  }

  /**
   * Conversion of eml to JSON
   *
   * @param {XmlString} emlSource
   * @return {*} //TODO RETURN TYPE
   * @memberof DarwinCoreService
   */
  async transformEMLtoJSON(emlSource: XmlString, stylesheet: any): Promise<any> {
    // for future reference
    // https://saxonica.plan.io/boards/5/topics/8759?pn=1&r=8766#message-8766
    //to see the library's author respond to one of our questions

    const result: {
      principalResult: string;
      resultDocuments: unknown;
      stylesheetInternal: Record<string, unknown>;
      masterDocument: unknown;
    } = SaxonJS2N.transform({
      stylesheetText: stylesheet,
      sourceText: emlSource,
      destination: 'serialized'
    });

    return JSON.parse(result.principalResult);
  }

  /**
   *  Temp replacement for validation until more requirements are set
   *
   * @param {number} submissionId
   * @return {*} //TODO RETURN TYPE
   * @memberof DarwinCoreService
   */
  async tempValidateSubmission(submissionId: number) {
    const submissionService = new SubmissionService(this.connection);

    await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);

    return { validation: true, mediaState: { fileName: '', fileErrors: [], isValid: true }, csvState: [] };
  }

  /**
   * Validate submission against style sheet
   *
   * @param {number} submissionId
   * @param {number} [styleSheetId]
   * @return {*}  {Promise<{ validation: boolean; mediaState: IMediaState; csvState?: ICsvState[] }>}
   * @memberof DarwinCoreService
   */
  async validateSubmission(
    submissionId: number,
    styleSheetId?: number
  ): Promise<{ validation: boolean; mediaState: IMediaState; csvState?: ICsvState[] }> {
    const dwcArchive: DWCArchive = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);

    const validationService = new ValidationService(this.connection);

    const styleSchema = await validationService.getStyleSchemaByStyleId(styleSheetId || 1); //TODO Hard coded

    const response = await validationService.validateDWCArchiveWithStyleSchema(dwcArchive, styleSchema);

    const submissionService = new SubmissionService(this.connection);

    if (!response.validation) {
      await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.REJECTED);
    } else {
      await submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);
    }

    return response;
  }

  async uploadtoElasticSearch(dataPackageId: string, convertedEML: string) {
    const esClient = await this.getEsClient();

    return esClient.create({
      id: dataPackageId,
      index: ES_INDEX.EML,
      document: convertedEML
    });
  }
}
