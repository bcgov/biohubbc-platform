import { XMLParser } from 'fast-xml-parser';
import { ES_INDEX } from '../constants/database';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { ICsvState } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { SecurityService } from './security-service';
import { SpatialService } from './spatial-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

const defaultLog = getLogger('services/dwc-service');

export class DarwinCoreService extends DBService {
  submissionService: SubmissionService;
  spatialService: SpatialService;

  /**
   * Creates an instance of DarwinCoreService.
   *
   * @param {IDBConnection} connection
   * @memberof DarwinCoreService
   */
  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialService = new SpatialService(this.connection);
    this.submissionService = new SubmissionService(this.connection);
  }

  /**
   * Process an incoming DwCA Submission.
   *
   * @param {Express.Multer.File} file
   * @param {string} dataPackageId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async intake(file: Express.Multer.File, dataPackageId: string): Promise<void> {
    const submissionExists = await this.submissionService.getSubmissionIdByUUID(dataPackageId);

    if (submissionExists?.submission_id) {
      const { submission_id } = submissionExists;
      await this.submissionService.setSubmissionEndDateById(submission_id);

      //Delete scraped spatial components table details
      await this.spatialService.deleteSpatialComponentsTransformRefsBySubmissionId(submission_id);
      await this.spatialService.deleteSpatialComponentsBySubmissionId(submission_id);
    }

    return this.create(file, dataPackageId);
  }

  /**
   * Process a new DwCA submission.
   *
   * @param {Express.Multer.File} file
   * @param {string} dataPackageId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async create(file: Express.Multer.File, dataPackageId: string): Promise<void> {
    let submissionId = 0;

    //Step 1: ingest dwca file and save record in db. additionally
    try {
      const ingest = await this.ingestNewDwCADataPackage(file, dataPackageId);

      submissionId = ingest.submissionId;

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.INGESTED);
    } catch (error: any) {
      defaultLog.debug({ label: 'ingestNewDwCADataPackage', message: 'error', error });

      throw new ApiGeneralError('Ingestion failed', error.message);
    }

    //Step 2: Upload file to s3
    try {
      await this.uploadRecordToS3(submissionId, file);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.UPLOADED);
    } catch (error: any) {
      defaultLog.debug({ label: 'uploadRecordToS3', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_UPLOAD,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 3: Validate submission file
    try {
      await this.tempValidateSubmission(submissionId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.VALIDATED);
    } catch (error: any) {
      defaultLog.debug({ label: 'tempValidateSubmission', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_VALIDATION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 4: Secure submission file
    try {
      await this.tempSecureSubmission(submissionId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.SECURED);
    } catch (error: any) {
      defaultLog.debug({ label: 'tempSecureSubmission', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_SECURITY,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 5: Ingest EML from dwca file
    try {
      await this.ingestNewDwCAEML(submissionId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.EML_INGESTED);
    } catch (error: any) {
      defaultLog.debug({ label: 'ingestNewDwCAEML', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_EML_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 6: Convert eml to json and save record
    try {
      await this.convertSubmissionEMLtoJSON(submissionId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.EML_TO_JSON);
    } catch (error: any) {
      defaultLog.debug({ label: 'convertSubmissionEMLtoJSON', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_EML_TO_JSON,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 7: Transform submission file and upload to ES
    try {
      await this.transformAndUploadMetaData(submissionId, dataPackageId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.METADATA_TO_ES);
    } catch (error: any) {
      defaultLog.debug({ label: 'transformAndUploadMetaData', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 8: Normalize Submission record and save json
    try {
      const dwcArchive = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);
      await this.normalizeSubmissionDWCA(submissionId, dwcArchive);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.NORMALIZED);
    } catch (error: any) {
      defaultLog.debug({ label: 'normalizeSubmissionDWCA', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_NORMALIZATION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }

    //Step 9: Run spatial transforms and save data
    try {
      await this.spatialService.runSpatialTransforms(submissionId);

      await this.submissionService.insertSubmissionStatus(
        submissionId,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSpatialTransform', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      return;
    }
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
    dataPackageId: string
  ): Promise<{ dataPackageId: string; submissionId: number }> {
    const dwcArchive = this.prepDWCArchive(file);

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    const response = await this.submissionService.insertSubmissionRecord({
      source_transform_id: sourceTransformRecord.source_transform_id,
      input_file_name: dwcArchive.rawFile.fileName,
      input_key: '',
      record_effective_date: new Date().toISOString(),
      eml_source: '',
      eml_json_source: '',
      darwin_core_source: '{}',
      uuid: dataPackageId
    });

    const submissionId = response.submission_id;

    return { dataPackageId, submissionId };
  }

  /**
   * Upload record to s3
   *
   * @param {number} submissionId
   * @param {Express.Multer.File} file
   * @return {*}  {Promise<{ s3Key: string }>}
   * @memberof DarwinCoreService
   */
  async uploadRecordToS3(submissionId: number, file: Express.Multer.File): Promise<{ s3Key: string }> {
    const s3Key = generateS3FileKey({
      submissionId: submissionId,
      fileName: file.originalname
    });

    await this.submissionService.updateSubmissionRecordInputKey(submissionId, s3Key);

    const response = await uploadFileToS3(file, s3Key, {
      filename: file.originalname
    });

    return { s3Key: response.Key };
  }

  /**
   * Parse submission record to DWCArchive file
   *
   * @param {number} submissionId
   * @return {*}  {Promise<DWCArchive>}
   * @memberof DarwinCoreService
   */
  async getSubmissionRecordAndConvertToDWCArchive(submissionId: number): Promise<DWCArchive> {
    const file = await this.submissionService.getIntakeFileFromS3(submissionId);

    return this.prepDWCArchive(file);
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
   * Collect eml file from dwca and save to db
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async ingestNewDwCAEML(submissionId: number): Promise<void> {
    const dwcaFile = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);

    if (dwcaFile.eml) {
      await this.submissionService.updateSubmissionRecordEMLSource(submissionId, dwcaFile.eml);
    }
  }

  /**
   * Converts submission EML to JSON and persists with submission record.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ occurrence_id: number }[]>}
   * @memberof DarwinCoreService
   */
  async convertSubmissionEMLtoJSON(submissionId: number): Promise<void> {
    const dwcaFile = await this.getSubmissionRecordAndConvertToDWCArchive(submissionId);

    if (dwcaFile.eml) {
      const emlmediaFile = dwcaFile.eml;

      const options = {
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseTagValue: false, //passes all through as strings. this avoids problems where text fields have numbers only but need to be interpreted as text.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        isArray: (tagName: string, _jPath: string, _isLeafNode: boolean, _isAttribute: boolean) => {
          const tagsArray: Array<string> = ['relatedProject', 'section', 'taxonomicCoverage'];
          if (tagsArray.includes(tagName)) return true;
          return false;
        }
      };
      const parser = new XMLParser(options);
      const eml_json_source = parser.parse(emlmediaFile.emlFile.buffer.toString() as string);

      await this.submissionService.updateSubmissionRecordEMLJSONSource(submissionId, eml_json_source);

      return eml_json_source;
    }
  }

  /**
   * transform submission record eml to metadata json and upload to search engine
   *
   * @param {number} submissionId
   * @param {string} dataPackageId
   * @return {*}  {Promise<WriteResponseBase>}
   * @memberof DarwinCoreService
   */
  async transformAndUploadMetaData(submissionId: number, dataPackageId: string): Promise<void> {
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord.eml_source) {
      throw new ApiGeneralError('The eml source is not available');
    }

    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySourceTransformId(
      submissionRecord.source_transform_id
    );

    if (!sourceTransformRecord.metadata_transform) {
      throw new ApiGeneralError('The source metadata transform is not available');
    }

    const jsonMetadata = await this.submissionService.getSubmissionMetadataJson(
      submissionId,
      sourceTransformRecord.metadata_transform
    );

    if (!jsonMetadata) {
      throw new ApiGeneralError('The source metadata json is not available');
    }

    // call to the ElasticSearch API to create a record with our transformed EML
    await this.uploadToElasticSearch(dataPackageId, jsonMetadata);
  }

  /**
   *  Temp replacement for validation until more requirements are set
   *
   * @param {number} submissionId
   * @return {*} //TODO RETURN TYPE
   * @memberof DarwinCoreService
   */
  async tempValidateSubmission(submissionId: number) {
    return {
      validation: true,
      mediaState: { fileName: `${submissionId}`, fileErrors: [], isValid: true },
      csvState: []
    };
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
      throw new ApiGeneralError('Validation failed');
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
      throw new ApiGeneralError('Secure submission failed');
    }

    return response;
  }

  /**
   * Upload file to ES
   *
   * @param {string} dataPackageId
   * @param {string} convertedEML
   * @return {*}
   * @memberof DarwinCoreService
   */
  async uploadToElasticSearch(dataPackageId: string, convertedEML: string) {
    const esClient = await this.getEsClient();

    return esClient.index({
      id: dataPackageId,
      index: ES_INDEX.EML,
      document: convertedEML
    });
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

    await this.submissionService.updateSubmissionRecordDWCSource(submissionId, normalized);
  }

  /**
   * Return normalized dwca file data
   *
   * @param {DWCArchive} dwcArchiveFile
   * @return {*}  {string}
   * @memberof DarwinCoreService
   */
  normalizeDWCA(dwcArchiveFile: DWCArchive): string {
    const normalized = {};

    Object.entries(dwcArchiveFile.worksheets).forEach(([key, value]) => {
      if (value) {
        normalized[key] = value.getRowObjects();
      }
    });

    return JSON.stringify(normalized);
  }

  /**
   * Delete old data from ES
   *
   * @param {string} dataPackageId
   * @return {*}
   * @memberof DarwinCoreService
   */
  async deleteEmlFromElasticSearchByDataPackageId(dataPackageId: string) {
    const esClient = await this.getEsClient();

    return esClient.delete({ id: dataPackageId, index: ES_INDEX.EML });
  }
}
