import { XMLParser } from 'fast-xml-parser';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import {
  ISubmissionJobQueue,
  ISubmissionMetadataRecord,
  ISubmissionObservationRecord,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { EMLFile } from '../utils/media/eml/eml-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia, UnknownMedia } from '../utils/media/media-utils';
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
      await this.submissionService.updateSubmissionMetadataRecordEndDate(submission_id);

      //Delete scraped spatial components table details
      await this.spatialService.deleteSpatialComponentsSpatialTransformRefsBySubmissionId(submission_id);
      await this.spatialService.deleteSpatialComponentsSecurityTransformRefsBySubmissionId(submission_id);
      await this.spatialService.deleteSpatialComponentsBySubmissionId(submission_id);
    }

    // return this.create(file, dataPackageId);
  }

  async intakeJob(intakeRecord: ISubmissionJobQueue): Promise<void> {
    const submissionMetadataId = await this.intakeJob_step1(intakeRecord.submission_id);

    console.log('submissionMetadataId', submissionMetadataId);

    const dwcaFile = await this.intakeJob_step2(intakeRecord);

    console.log('dwcaFile', dwcaFile);

    await this.intakeJob_step3(intakeRecord.submission_id, dwcaFile);

    await this.intakeJob_step4(intakeRecord.submission_id);

    await this.intakeJob_step5(intakeRecord.submission_id);
  }

  /**
   * Create submission metadata record.
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
        eml_json_source: '',
        record_effective_timestamp: null,
        record_end_timestamp: null
      };

      return this.submissionService.insertSubmissionMetadataRecord(submissionMetadata);
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
   * Import data from S3 to Submission Metadata EML
   *
   * @param {number} submissionJobQueueId
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step2(intakeRecord: ISubmissionJobQueue): Promise<DWCArchive> {
    try {
      const file = await this.getAndPrepFileFromS3(intakeRecord.submission_job_queue_id);

      if (file.eml) {
        await this.submissionService.updateSubmissionMetadataEMLSource(intakeRecord.submission_id, file.eml);

        return file;
      } else {
        throw new ApiGeneralError('Inserting new Metadata record');
      }
    } catch (error: any) {
      defaultLog.debug({ label: 'insertSubmissionMetadataRecord', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        intakeRecord.submission_id,
        SUBMISSION_STATUS_TYPE.FAILED_EML_INGESTION,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Inserting new Metadata record', error.message);
    }
  }

  /**
   * Convert EML to JSON and Save data
   *
   * @param {number} submissionId
   * @param {DWCArchive} file
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step3(submissionId: number, file: DWCArchive): Promise<any> {
    try {
      if (file.eml) {
        const jsonData = await this.convertSubmissionEMLtoJSON(file.eml);

        await this.submissionService.updateSubmissionRecordEMLJSONSource(submissionId, JSON.stringify(jsonData));
      }
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
   * Update SubmissionId Records End Date and Effective Date
   *
   * @param {number} submissionId
   * @return {*}  {Promise<any>}
   * @memberof DarwinCoreService
   */
  async intakeJob_step4(submissionId: number): Promise<any> {
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
   * transform and upload metadata to ES
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
      defaultLog.debug({ label: 'transformAndUploadMetaData', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );

      throw new ApiGeneralError('Transforming and uploading metadata', error.message);
    }
  }

  async intakeJob_step6(
    submissionId: number,
    file: DWCArchive
  ): Promise<{ submission_observation_id: number } | undefined> {
    try {
      if (file.worksheets) {
        //TODO: Double check intital data entered

        const submissionObservationData: ISubmissionObservationRecord = {
          submission_id: submissionId,
          darwin_core_source: {},
          submission_security_request: null,
          foi_reason_description: null,
          record_effective_timestamp: null,
          record_end_timestamp: null
        };

        return this.submissionService.insertSubmissionObservationRecord(submissionObservationData);
      }

      // const normalized = this.normalizeDWCA(file);
    } catch (error: any) {
      defaultLog.debug({ label: 'transformAndUploadMetaData', message: 'error', error });

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
   * Access file from S3 and prep into DWCA File
   *
   * @param {number} submissionJobQueueId
   * @return {*}
   * @memberof DarwinCoreService
   */
  async getAndPrepFileFromS3(submissionJobQueueId: number) {
    //TODO: S3 filelocation UUID setup
    const fileLocation = `/datasets/UUID/DwCA/${submissionJobQueueId}/UUID.zip`;
    const file = await this.submissionService.getIntakeFileFromS3(fileLocation);

    if (!file) {
      throw new ApiGeneralError('The source file is not available');
    }

    return this.prepDWCArchive(file);
  }

  /**
   * Step 8 in processing a DWC archive file: run spatial transforms
   *
   * @param {number} submissionId
   * @param {boolean} metadataOnly A flag to determine if occurrence transforms need to be run
   * @return {*}
   * @memberof DarwinCoreService
   */
  async create_step8_runSpatialTransforms(submissionId: number) {
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

      throw new ApiGeneralError('Running spatial transforms failed', error.message);
    }
  }

  /**
   * Step 9 in processing a DWC archive file: run security transforms
   *
   * @param {number} submissionId
   * @return {*}
   * @memberof DarwinCoreService
   */
  async create_step9_runSecurityTransforms(submissionId: number) {
    try {
      await this.spatialService.runSecurityTransforms(submissionId);
      await this.submissionService.insertSubmissionStatus(
        submissionId,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_SECURE
      );
    } catch (error: any) {
      defaultLog.debug({ label: 'runSecurityTransforms', message: 'error', error });

      await this.submissionService.insertSubmissionStatusAndMessage(
        submissionId,
        SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_SECURE,
        SUBMISSION_MESSAGE_TYPE.ERROR,
        error.message
      );
      throw new ApiGeneralError('Run security transforms failed', error.message);
    }
  }

  /**
   * Ingest a Darwin Core Archive (DwCA) data package.
   *
   * @param {{ dataPackageId?: string }} [options]
   * @return {*}  {Promise<{ dataPackageId: string; submissionId: number }>}
   * @memberof DarwinCoreService
   */
  async ingestNewDwCADataPackage(dataPackageId: string): Promise<{ dataPackageId: string; submissionId: number }> {
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

    return esClient.delete({ id: dataPackageId, index: ElasticSearchIndices.EML });
  }
}
