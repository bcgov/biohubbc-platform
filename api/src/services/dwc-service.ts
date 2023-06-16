import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import {
  ISubmissionJobQueueRecord,
  ISubmissionMetadataRecord,
  ISubmissionObservationRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { copyFileInS3, deleteFileFromS3, generateDatasetS3FileKey, getFileFromS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';
import { EMLService } from './eml-service';
import { ElasticSearchIndices } from './es-service';
import { SpatialService } from './spatial-service';
import { SubmissionService } from './submission-service';

const defaultLog = getLogger('services/dwc-service');

export class DarwinCoreService extends DBService {
  submissionService: SubmissionService;
  spatialService: SpatialService;
  emlService: EMLService;

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
    this.emlService = new EMLService(this.connection);
  }

  // Look and see if the decorate needs to be run on a fresh record
  async intakeJob(jobQueueRecord: ISubmissionJobQueueRecord): Promise<void> {
    // Step 1: Insert submission metadata record
    const submissionMetadataId = await this.intakeJob_step_1(jobQueueRecord.submission_id);

    // Step 2: Prep file and set submission metadata eml source column
    const dwcaFile = await this.intakeJob_step_2(jobQueueRecord, submissionMetadataId.submission_metadata_id);

    // Step 3: Convert eml to JSON object
    const emlJSON = await this.intakeJob_step_3(jobQueueRecord.submission_id, dwcaFile);

    // Step 4: Update submission JSON column
    await this.intakeJob_step_4(jobQueueRecord.submission_id, submissionMetadataId.submission_metadata_id, emlJSON);

    // Step 5: Normalize data
    const normalizedJSON = await this.intakeJob_step_5(dwcaFile);

    // Step 6: End date old records
    await this.intakeJob_step_6(jobQueueRecord);

    // Step 7: Insert submission observation record
    const submissionObservation = await this.intakeJob_step_7(jobQueueRecord, normalizedJSON);

    // Step 8: Run spatial transforms
    await this.intakeJob_step_8(jobQueueRecord, submissionObservation.submission_observation_id);

    // Step 9: Decorate EML
    const decoratedEML = await this.intakeJob_step_9(emlJSON);

    // Step 10: Update submission json column with decorated eml
    await this.intakeJob_step_10(
      jobQueueRecord.submission_id,
      submissionMetadataId.submission_metadata_id,
      decoratedEML
    );

    // Step 11: Run source transforms on decorated data
    await this.intakeJob_step_11(jobQueueRecord);

    // Step 12: Run security transforms
    await this.intakeJob_step_12(jobQueueRecord);

    // Step 13: Update S3 location
    await this.intakeJob_step_13(jobQueueRecord);

    await this.submissionService.insertSubmissionStatus(jobQueueRecord.submission_id, SUBMISSION_STATUS_TYPE.INGESTED);
  }

  /**
   * Step 1
   * - Insert submission metadata record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{
   *     submission_metadata_id: number;
   *   }>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step_1(submissionId: number): Promise<{
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
      defaultLog.debug({ label: 'intakeJob_step_1', message: 'error', error });

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
   * Step 2
   * - Download DwCA file form S3
   * - Update submission metadata record - set EML source column
   *
   * @param {number} submissionJobQueueId
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step_2(jobQueueRecord: ISubmissionJobQueueRecord, submissionMetadataId: number): Promise<DWCArchive> {
    try {
      if (!jobQueueRecord.key) {
        throw new ApiGeneralError('No S3 Key given');
      }

      const file = await this.getAndPrepFileFromS3(jobQueueRecord.key);

      if (!file.eml) {
        throw new ApiGeneralError('Accessing S3 File, file eml is empty');
      }

      await this.submissionService.updateSubmissionMetadataEMLSource(
        jobQueueRecord.submission_id,
        submissionMetadataId,
        file.eml
      );

      return file;
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_2', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_EML_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Accessing S3 File and Updating new Metadata record', error.message);
    }
  }

  /**
   * Step 3
   * - Convert EML to JSON
   *
   * @param {number} submissionId
   * @param {DWCArchive} file
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step_3(submissionId: number, file: DWCArchive): Promise<Record<string, any>> {
    try {
      if (!file.eml) {
        throw new ApiGeneralError('file eml is empty');
      }

      // Convert the EML data from XML to JSON
      return this.emlService.convertXMLStringToJSObject(file.eml.emlFile.buffer.toString());
    } catch (error: any) {
      // TODO: does it make sense to throw/ catch here? is it even possible
      defaultLog.debug({ label: 'intakeJob_step_3', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_EML_TO_JSON,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Converting EML to JSON', error.message);
    }
  }

  /**
   * Step 4
   * Update submission record json column
   *
   * @param submissionId
   * @param submissionMetadataId
   * @param emlJSON
   */
  async intakeJob_step_4(submissionId: number, submissionMetadataId: number, emlJSON: any): Promise<void> {
    try {
      await this.submissionService.updateSubmissionRecordEMLJSONSource(
        submissionId,
        submissionMetadataId,
        JSON.stringify(emlJSON)
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_4', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_EML_TO_JSON,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Storing eml JSON data', error.message);
    }
  }

  /**
   * Step 5
   * Normalize DWCArchive file
   *
   * @param dwcaFile
   * @returns {*} Promise<string>
   */
  async intakeJob_step_5(dwcaFile: DWCArchive): Promise<string> {
    try {
      return dwcaFile.normalize();
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_5', message: 'error', error });
      // TODO: does this try catch make sense?
      throw new ApiGeneralError('Normalizing DWC Archive', error.message);
    }
  }

  /**
   * Step 6
   * End date old submission records
   *
   * @param jobQueueRecord
   */
  async intakeJob_step_6(jobQueueRecord: ISubmissionJobQueueRecord) {
    try {
      // END DATE OLD METADATA
      await this.submissionService.updateSubmissionMetadataRecordEndDate(jobQueueRecord.submission_id);
      await this.submissionService.updateSubmissionMetadataRecordEffectiveDate(jobQueueRecord.submission_id);

      // END DATE OLF OBSERVATION RECORD
      await this.updateSubmissionObservationEndTimestamp(jobQueueRecord);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_6', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.OUT_DATED_RECORD,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Update Submission dates', error.message);
    }
  }

  /**
   * Step 7
   * Create submission observation record with normalized JSON
   *
   * @param jobQueueRecord
   * @param normalizedJSON
   * @returns
   */
  async intakeJob_step_7(
    jobQueueRecord: ISubmissionJobQueueRecord,
    normalizedJSON: string
  ): Promise<{ submission_observation_id: number }> {
    try {
      return await this.insertSubmissionObservationRecord(jobQueueRecord, normalizedJSON);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_7', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );
      throw new ApiGeneralError('Inserting Observation JSON', error.message);
    }
  }

  /**
   * Step 8
   * Run spatial transformations
   *
   * @param jobQueueRecord
   * @param submissionObservationId
   */
  async intakeJob_step_8(jobQueueRecord: ISubmissionJobQueueRecord, submissionObservationId: number): Promise<void> {
    try {
      await this.runSpatialTransforms(jobQueueRecord, submissionObservationId);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_8', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );
      throw new ApiGeneralError('Spatial transform', error.message);
    }
  }

  /**
   * Step 9
   * Decorate EML
   *
   * @param emlJSON
   * @returns  {*} Promise<Record<string, any>> Decorated JSON object
   */
  async intakeJob_step_9(emlJSON: Record<string, any>): Promise<Record<string, any>> {
    try {
      return await this.emlService.decorateEML(emlJSON);
    } catch (error: any) {
      // TODO: does this trycatch here make sense? 
      defaultLog.debug({ label: 'intakeJob_step_9', message: 'error', error });

      throw new ApiGeneralError('EML Decoration', error.message);
    }
  }

  /**
   * Step 10
   * Update submission record with decorated EML
   *
   * @param submissionId number
   * @param submissionMetadataId  number
   * @param emlJSON Record<string, any>
   */
  async intakeJob_step_10(submissionId: number, submissionMetadataId: number, emlJSON: Record<string, any>) {
    try {
      await this.submissionService.updateSubmissionRecordEMLJSONSource(
        submissionId,
        submissionMetadataId,
        JSON.stringify(emlJSON)
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_10', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Updating Record EML', error.message);
    }
  }

  /**
   * Step 11
   * Run source transform on decorated JSON
   * @param jobQueueRecord
   * @param submissionObservationId
   */
  async intakeJob_step_11(jobQueueRecord: ISubmissionJobQueueRecord) {
    try {
      await this.transformAndUploadMetaData(jobQueueRecord.submission_id);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_11', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading metadata', error.message);
    }
  }

  /**
   * Step 12
   * Run security transforms on decorated JSON
   * @param jobQueueRecord
   */
  async intakeJob_step_12(jobQueueRecord: ISubmissionJobQueueRecord) {
    try {
      await this.runSecurityTransforms(jobQueueRecord);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_12', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_SECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Secure spatial transforms', error.message);
    }
  }

  /**
   * Step 13
   * Updated S3 file location
   * @param jobQueueRecord
   */
  async intakeJob_step_13(jobQueueRecord: ISubmissionJobQueueRecord) {
    try {
      await this.updateS3FileLocation(jobQueueRecord);
    } catch (error: any) {
      defaultLog.debug({ label: 'intakeJob_step_13', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_UPLOAD,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('S3 location update', error.message);
    }
  }

  /**
   * Update and set all matching submission record end timestamps.
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async updateSubmissionObservationEndTimestamp(jobQueueRecord: ISubmissionJobQueueRecord): Promise<void> {
    try {
      await this.submissionService.updateSubmissionObservationRecordEndDate(jobQueueRecord.submission_id);
    } catch (error: any) {
      defaultLog.debug({ label: 'updateSubmissionObservationEndTimestamp', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
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
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @param {number} submissionObservationId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runTransformsOnObservations(
    jobQueueRecord: ISubmissionJobQueueRecord,
    submissionObservationId: number
  ): Promise<void> {
    try {
      await this.runSpatialTransforms(jobQueueRecord, submissionObservationId);

      await this.runSecurityTransforms(jobQueueRecord);
    } catch (error: any) {
      defaultLog.debug({ label: 'runTransformsOnObservations', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
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
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @param {string} dwcaJson
   * @return {*}  {Promise<{
   *     submission_observation_id: number;
   *   }>}
   * @memberof DarwinCoreService
   */
  async insertSubmissionObservationRecord(
    jobQueueRecord: ISubmissionJobQueueRecord,
    dwcaJson: string
  ): Promise<{
    submission_observation_id: number;
  }> {
    try {
      const submissionObservationData: ISubmissionObservationRecord = {
        submission_id: jobQueueRecord.submission_id,
        darwin_core_source: dwcaJson,
        submission_security_request: jobQueueRecord.security_request
      };

      return await this.submissionService.insertSubmissionObservationRecord(submissionObservationData);
    } catch (error: any) {
      defaultLog.debug({ label: 'insertSubmissionObservationRecord', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
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
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @param {number} submissionObservationId
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runSpatialTransforms(
    jobQueueRecord: ISubmissionJobQueueRecord,
    submissionObservationId: number
  ): Promise<void> {
    try {
      //run transform on observation data
      await this.spatialService.runSpatialTransforms(jobQueueRecord.submission_id, submissionObservationId);

      await this.submissionService.insertSubmissionStatus(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSpatialTransforms', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
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
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @return {*}  {Promise<void>}
   * @memberof DarwinCoreService
   */
  async runSecurityTransforms(jobQueueRecord: ISubmissionJobQueueRecord): Promise<void> {
    try {
      //run transform on observation data
      await this.spatialService.runSecurityTransforms(jobQueueRecord.submission_id);

      await this.submissionService.insertSubmissionStatus(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_SECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSecurityTransforms', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        jobQueueRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading secure spatial transforms', error.message);
    }
  }

  /**
   * Move S3 file to new home directory
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @memberof DarwinCoreService
   */
  async updateS3FileLocation(jobQueueRecord: ISubmissionJobQueueRecord) {
    const sourceS3Key = jobQueueRecord.key;

    if (!sourceS3Key) {
      return;
    }

    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(
      jobQueueRecord.submission_id
    );

    const fileName = `${submissionRecord.uuid}.zip`;

    const destinationS3Key = generateDatasetS3FileKey({ datasetUUID: submissionRecord.uuid, fileName: fileName });

    // Copy object to new location
    await copyFileInS3(sourceS3Key, destinationS3Key);

    // Delete original object
    await deleteFileFromS3(sourceS3Key);
  }

  /**
   * Access file from S3 and prep into DWCA File
   *
   * @param {string} fileKey
   * @return {*}
   * @memberof DarwinCoreService
   */
  async getAndPrepFileFromS3(fileKey: string) {
    const s3File = await getFileFromS3(fileKey);

    if (!s3File) {
      throw new ApiGeneralError('The source file is not available');
    }

    return this.prepDWCArchive(s3File);
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

    // update submission metadata with a copy of the elastic search object
    await this.submissionService.updateSubmissionMetadataWithSearchKeys(submissionId, jsonMetadata);
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
