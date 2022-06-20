import { XmlString } from 'aws-sdk/clients/applicationautoscaling';
import SaxonJS2N from 'saxon-js';
import { v4 as uuidv4 } from 'uuid';
import { ES_INDEX } from '../constants/database';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateS3FileKey, getFileFromS3, uploadFileToS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState } from '../utils/media/media-file';
import { parseS3File, parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { OccurrenceService } from './occurrence-service';
import { SecurityService } from './security-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

const defaultLog = getLogger('services/dwc-service');

export class DarwinCoreService extends DBService {
  submissionService: SubmissionService;

  /**
   * Creates an instance of DarwinCoreService.
   *
   * @param {IDBConnection} connection
   * @memberof DarwinCoreService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionService = new SubmissionService(this.connection);
  }

  /**
   * intake dwca file
   *
   * @param {Express.Multer.File} file
   * @param {string} dataPackageId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async intake(file: Express.Multer.File, dataPackageId: string): Promise<{ dataPackageId: string }> {
    const submissionExists = await this.submissionService.getSubmissionIdByUUID(dataPackageId);

    if (submissionExists?.submission_id) {
      await this.submissionService.setSubmissionEndDateById(submissionExists.submission_id);
      await this.deleteEmlFormElasticSearchByDataPackageId(dataPackageId);
      //TODO: Delete scraped spatial components table details when its filled
    }

    return this.create(file, dataPackageId);
  }

  async create(file: Express.Multer.File, dataPackageId: string): Promise<{ dataPackageId: string }> {
    const { submissionId } = await this.ingestNewDwCADataPackage(file, {
      dataPackageId: dataPackageId
    });

    try {
      await this.tempValidateSubmission(submissionId);
    } catch (error) {
      defaultLog.debug({ label: 'tempValidateSubmission', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'Failed to validate submission record'
      );
    }

    try {
      await this.transformAndUploadMetaData(submissionId, dataPackageId);
    } catch (error) {
      defaultLog.debug({ label: 'transformAndUploadMetaData', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'Failed to transform and upload metadata'
      );
    }

    try {
      const dwcArchive = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);
      await this.normalizeSubmissionDWCA(submissionId, dwcArchive);
    } catch (error) {
      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'Failed to normalize dwca file'
      );
    }

    return { dataPackageId };
  }

  /**
   * Parse submission record to DWCArchive file
   *
   * @param {number} submissionId
   * @return {*}  {Promise<DWCArchive>}
   * @memberof DarwinCoreService
   */
  async getSubmissionRecordAndConvertToDWCArchive(submissionId: number): Promise<DWCArchive> {
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

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

    //TODO: if fail post failure status
    await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);

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

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    const response = await this.submissionService.insertSubmissionRecord({
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

    await this.submissionService.updateSubmissionRecordInputKey(submissionId, s3Key);

    await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMITTED);

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
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord.eml_source) {
      throw new ApiGeneralError('The eml source is not available');
    }

    const s3File = await this.submissionService.getStylesheetFromS3(submissionId);

    const stylesheet = parseS3File(s3File)?.buffer?.toString();

    if (!stylesheet) {
      throw new ApiGeneralError('Failed to parse the stylesheet');
    }

    let transformedEML;
    //call to the SaxonJS library to transform out EML into a JSON structure using XSLT stylesheets
    try {
      transformedEML = await this.transformEMLtoJSON(submissionRecord.eml_source, stylesheet);
    } catch (error) {
      defaultLog.debug({ label: 'transformEMLtoJSON', message: 'error', error });

      return this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'eml transformation failed'
      );
    }

    let response;
    //call to the ElasticSearch API to create a record with our transformed EML
    try {
      response = await this.uploadToElasticSearch(dataPackageId, transformedEML);
    } catch (error) {
      defaultLog.debug({ label: 'uploadToElasticSearch', message: 'error', error });

      return this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'upload to elastic search failed'
      );
    }

    //TODO: We need a new submission status type
    await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);

    return response;
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

    if (!result.principalResult) {
      throw new ApiGeneralError('Failed to transform eml with stylesheet');
    }

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
    await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);

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

    if (!response.validation) {
      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.REJECTED);
    } else {
      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);
    }

    return response;
  }

  /**
   * Temp replacement for secure until more requirements are set
   *
   * @param {number} submissionId
   * @return {*}
   * @memberof DarwinCoreService
   */
  async tempSecureSubmission(submissionId: number) {
    await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SECURED);

    return { secure: true };
  }

  /**
   * Validate Security rules of submission record and set status
   *
   * @param {number} submissionId
   * @param {number} securityId
   * @return {*} //TODO return type
   * @memberof DarwinCoreService
   */
  async secureSubmission(submissionId: number, securityId: number) {
    const securityService = new SecurityService(this.connection);

    const securitySchema = await securityService.getSecuritySchemaBySecurityId(securityId); //TODO hardcoded return

    const response = await securityService.validateSecurityOfSubmission(submissionId, securitySchema);

    if (!response.secure) {
      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.REJECTED);
    } else {
      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SECURED);
    }

    return response;
  }

  async uploadToElasticSearch(dataPackageId: string, convertedEML: string) {
    const esClient = await this.getEsClient();

    const response = await esClient.create({
      id: dataPackageId,
      index: ES_INDEX.EML,
      document: convertedEML
    });

    return response;
  }

  /**
   * Normalize all worksheets in dwcArchive file and update submission record
   *
   * @param {number} submissionId
   * @param {DWCArchive} dwcArchiveFile
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof DarwinCoreService
   */
  async normalizeSubmissionDWCA(submissionId: number, dwcArchiveFile: DWCArchive): Promise<void> {
    const normalized = this.normalizeDWCA(dwcArchiveFile);

    try {
      await this.submissionService.updateSubmissionRecordDWCSource(submissionId, normalized);

      //TODO: We need a new submission status type
      await this.submissionService.insertSubmissionStatus(
        submissionId,
        SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED
      );
    } catch (error) {
      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'update submission record failed'
      );
    }
  }

  normalizeDWCA(dwcArchiveFile: DWCArchive): string {
    const normalized = {};

    Object.entries(dwcArchiveFile.worksheets).forEach(([key, value]) => {
      if (value) {
        normalized[key] = value.getRowObjects();
      }
    });

    return JSON.stringify(normalized);
  }

  async deleteEmlFormElasticSearchByDataPackageId(dataPackageId: string) {
    const esClient = await this.getEsClient();

    const response = await esClient.delete({ id: dataPackageId, index: ES_INDEX.EML });

    return response;
  }
}
