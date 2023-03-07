import { XMLParser } from 'fast-xml-parser';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import {
  ISubmissionJobQueueRecord,
  ISubmissionMetadataRecord,
  ISubmissionObservationRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { copyFileInS3, deleteFileFromS3, generateS3FileKey } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { EMLFile } from '../utils/media/eml/eml-file';
import { ArchiveFile } from '../utils/media/media-file';
import { normalizeDWCA, parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { ElasticSearchIndices } from './es-service';
import { SpatialService } from './spatial-service';
import { SubmissionService } from './submission-service';

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
   * Start intake job for job queue record
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async intakeJob(intakeRecord: ISubmissionJobQueueRecord): Promise<void> {
    const submissionMetadataId = await this.intakeJob_step1(intakeRecord.submission_id);

    const dwcaFile = await this.intakeJob_step2(intakeRecord, submissionMetadataId.submission_metadata_id);

    await this.intakeJob_step3(intakeRecord.submission_id, dwcaFile, submissionMetadataId.submission_metadata_id);

    await this.intakeJob_step4(intakeRecord.submission_id);

    await this.intakeJob_step5(intakeRecord.submission_id);

    await this.intakeJob_step6(intakeRecord, dwcaFile);

    await this.intakeJob_finishIntake(intakeRecord);
  }

  /**
   * Step 1: Create submission metadata record.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{
   *     submission_metadata_id: number;
   *   }>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step1(submissionId: number): Promise<{
    submission_metadata_id: number;
  }> {
    try {
      const submissionMetadata: ISubmissionMetadataRecord = {
        submission_id: submissionId,
        eml_source: '',
        eml_json_source: null
      };

      return await this.submissionService.insertSubmissionMetadataRecord(submissionMetadata);
    } catch (error: any) {
      defaultLog.debug({ label: 'insertSubmissionMetadataRecord', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Inserting new Metadata record', error.message);
    }
  }

  /**
   * Step 2: Import data from S3 to Submission Metadata EML
   *
   * @param {number} submissionJobQueueId
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step2(intakeRecord: ISubmissionJobQueueRecord, submissionMetadataId: number): Promise<DWCArchive> {
    try {
      if (!intakeRecord.key) {
        throw new ApiGeneralError('No S3 Key given');
      }

      const file = await this.getAndPrepFileFromS3(intakeRecord.key);

      if (!file.eml) {
        throw new ApiGeneralError('Accessing S3 File, file eml is empty');
      }

      await this.submissionService.updateSubmissionMetadataEMLSource(
        intakeRecord.submission_id,
        submissionMetadataId,
        file.eml
      );

      return file;
    } catch (error: any) {
      defaultLog.debug({ label: 'insertSubmissionMetadataRecord', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_EML_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Accessing S3 File and Updating new Metadata record', error.message);
    }
  }

  /**
   * Step 3:  Convert EML to JSON and Save data
   *
   * @param {number} submissionId
   * @param {DWCArchive} file
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step3(submissionId: number, file: DWCArchive, submissionMetadataId: number): Promise<void> {
    try {
      if (!file.eml) {
        throw new ApiGeneralError('file eml is empty');
      }

      const jsonData = await this.convertSubmissionEMLtoJSON(file.eml);

      await this.submissionService.updateSubmissionRecordEMLJSONSource(
        submissionId,
        submissionMetadataId,
        JSON.stringify(jsonData)
      );
    } catch (error: any) {
      defaultLog.debug({
        label: 'convertSubmissionEMLtoJSON, updateSubmissionRecordEMLJSONSource',
        message: 'error',
        error
      });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_EML_TO_JSON,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Converting EML to JSON and Storing data', error.message);
    }
  }

  /**
   * Step 4: Update SubmissionId Records End Date and Effective Date
   *
   * @param {number} submissionId
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step4(submissionId: number): Promise<void> {
    try {
      await this.submissionService.updateSubmissionMetadataRecordEndDate(submissionId);
      await this.submissionService.updateSubmissionMetadataRecordEffectiveDate(submissionId);
    } catch (error: any) {
      defaultLog.debug({
        label: 'updateSubmissionMetadataRecordEndDate, updateSubmissionMetadataRecordEffectiveDate',
        message: 'error',
        error
      });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Updating Submission Record End/Effective Date', error.message);
    }
  }

  /**
   * Step 5: transform and upload metadata to ES
   *
   * @param {number} submissionId
   * @param {string} dataPackageId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step5(submissionId: number): Promise<void> {
    try {
      await this.transformAndUploadMetaData(submissionId);

      await this.submissionService.insertSubmissionStatus(submissionId, SUBMISSION_STATUS_TYPE.METADATA_TO_ES);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step5', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading metadata', error.message);
    }
  }

  /**
   * Step 6: If csv worksheets are present, create submission oberservation record.
   * Then transform and update details
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step6(intakeRecord: ISubmissionJobQueueRecord, dwcaWorksheets: DWCArchive): Promise<void> {
    try {
      const jsonData = normalizeDWCA(dwcaWorksheets);

      const submissionObservationId = await this.insertSubmissionObservationRecord(intakeRecord, jsonData);

      await this.runTransformsOnObservations(intakeRecord, submissionObservationId.submission_observation_id);

      await this.updateSubmissionObservationEffectiveAndEndDate(intakeRecord);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step6', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading metadata', error.message);
    }
  }

  /**
   * Finish intake job, move S3 file to home folder, update status and queue end date
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async intakeJob_finishIntake(intakeRecord: ISubmissionJobQueueRecord): Promise<void> {
    try {
      await this.updateS3FileLocation(intakeRecord);

      await this.submissionService.insertSubmissionStatus(intakeRecord.submission_id, SUBMISSION_STATUS_TYPE.INGESTED);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_finishIntake', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_UPLOAD,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading metadata', error.message);
    }
  }

  /**
   * Update Submission Record effective and end Date
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async updateSubmissionObservationEffectiveAndEndDate(intakeRecord: ISubmissionJobQueueRecord): Promise<void> {
    try {
      await this.submissionService.updateSubmissionObservationRecordEndDate(intakeRecord.submission_id);
      await this.submissionService.updateSubmissionObservationRecordEffectiveDate(intakeRecord.submission_id);
    } catch (error: any) {
      defaultLog.debug({ label: 'updateSubmissionObservationEffectiveAndEndDate', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Updating Submission Observation Record End and Effective Date', error.message);
    }
  }

  /**
   * Run both spatial and Security Transform on Observation
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @param {number} submissionObservationId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runTransformsOnObservations(
    intakeRecord: ISubmissionJobQueueRecord,
    submissionObservationId: number
  ): Promise<void> {
    try {
      await this.runSpatialTransforms(intakeRecord, submissionObservationId);

      await this.runSecurityTransforms(intakeRecord, submissionObservationId);
    } catch (error: any) {
      defaultLog.debug({ label: 'runTransformsOnObservations', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Running Transforms on Observation Data', error.message);
    }
  }

  /**
   * Insert new Submission Observation Record
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @param {string} dwcaJson
   * @return {*}  {Promise<{
   *     submission_observation_id: number;
   *   }>}
   * @memberof DarwinCoreService
   */
  async insertSubmissionObservationRecord(
    intakeRecord: ISubmissionJobQueueRecord,
    dwcaJson: string
  ): Promise<{
    submission_observation_id: number;
  }> {
    try {
      const submissionObservationData: ISubmissionObservationRecord = {
        submission_id: intakeRecord.submission_id,
        darwin_core_source: dwcaJson,
        submission_security_request: intakeRecord.security_request
      };

      return await this.submissionService.insertSubmissionObservationRecord(submissionObservationData);
    } catch (error: any) {
      defaultLog.debug({ label: 'insertSubmissionObservationRecord', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_UPLOAD,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Inserting Submission Observation Record', error.message);
    }
  }

  /**
   * Run Spatial Transform on Submission Observation Record
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @param {number} submissionObservationId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runSpatialTransforms(intakeRecord: ISubmissionJobQueueRecord, submissionObservationId: number): Promise<void> {
    try {
      //run transform on observation data
      await this.spatialService.runSpatialTransforms(submissionObservationId);

      await this.submissionService.insertSubmissionStatus(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSpatialTransforms', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading spatial transforms', error.message);
    }
  }

  /**
   * Run Security Transform on Submission Observation Record
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @param {number} submissionObservationId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runSecurityTransforms(intakeRecord: ISubmissionJobQueueRecord, submissionObservationId: number): Promise<void> {
    try {
      //run transform on observation data
      await this.spatialService.runSecurityTransforms(submissionObservationId);

      await this.submissionService.insertSubmissionStatus(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_SECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSecurityTransforms', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading secure spatial transforms', error.message);
    }
  }

  /**
   * Update and Move S3 file to new Home directory
   *
   * @param {ISubmissionJobQueueRecord} intakeRecord
   * @memberof DarwinCoreService
   */
  async updateS3FileLocation(intakeRecord: ISubmissionJobQueueRecord) {
    if (intakeRecord.key) {
      const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(
        intakeRecord.submission_id
      );

      const fileName = `${submissionRecord.uuid}.zip`;

      const newKey = generateS3FileKey({ uuid: submissionRecord.uuid, fileName: fileName });

      await copyFileInS3(intakeRecord.key, newKey);

      const jobQueueFolderKey = generateS3FileKey({
        uuid: submissionRecord.uuid,
        jobQueueId: intakeRecord.submission_job_queue_id
      });

      //Delete Zip from job queue folder
      await deleteFileFromS3(intakeRecord.key);

      //Delete job queue folder
      await deleteFileFromS3(`${jobQueueFolderKey}/`);
    }
  }

  /**
   * Access file from S3 and prep into DWCA File
   *
   * @param {number} submissionJobQueueId
   * @return {*}
   * @memberof DarwinCoreService
   */
  async getAndPrepFileFromS3(fileKey: string) {
    const file = await this.submissionService.getIntakeFileFromS3(fileKey);

    if (!file) {
      throw new ApiGeneralError('The source file is not available');
    }

    return this.prepDWCArchive(file);
  }

  /**
   * Ingest a Darwin Core Archive (DwCA) data package.
   *
   * @param {{ dataPackageId?: string }} [options]
   * @return {*}  {Promise<{ dataPackageId: string; submissionId: number }>}
   * @memberof DarwinCoreService
   */
  async ingestNewDwCADataPackage(
    file: Express.Multer.File,
    dataPackageId: string
  ): Promise<{ dataPackageId: string; submissionId: number }> {
    this.prepDWCArchive(file);

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    const response = await this.submissionService.insertSubmissionRecord({
      source_transform_id: sourceTransformRecord.source_transform_id,
      uuid: dataPackageId
    });

    const submissionId = response.submission_id;

    return { dataPackageId, submissionId };
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
   * Converts submission EML to JSON and persists with submission record.
   *
   * @param {EMLFile} file
   * @return {*}  {*}
   * @memberof DarwinCoreService
   */
  convertSubmissionEMLtoJSON(file: EMLFile): any {
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
    const eml_json_source = parser.parse(file.emlFile.buffer.toString() as string);

    return eml_json_source;
  }

  /**
   * transform submission record eml to metadata json and upload to search engine
   *
   * @param {number} submissionId
   * @param {string} dataPackageId
   * @return {*}  {Promise<WriteResponseBase>}
   * @memberof DarwinCoreService
   */
  async transformAndUploadMetaData(submissionId: number): Promise<void> {
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord.source_transform_id) {
      throw new ApiGeneralError('The source_transform_id is not available');
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
    await this.uploadToElasticSearch(submissionRecord.uuid, jsonMetadata);
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
      index: ElasticSearchIndices.EML,
      document: convertedEML
    });
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

    return esClient.delete({ id: dataPackageId, index: ElasticSearchIndices.EML });
  }
}
