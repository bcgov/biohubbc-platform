import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import {
  ISearchSubmissionCriteria,
  ISourceTransformModel,
  ISubmissionJobQueue,
  ISubmissionMetadataRecord,
  ISubmissionModel,
  ISubmissionModelWithStatus,
  ISubmissionObservationRecord,
  ISubmissionRecord,
  ISubmissionRecordWithSpatial,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { getFileFromS3 } from '../utils/file-utils';
import { EMLFile } from '../utils/media/eml/eml-file';
import { DBService } from './db-service';
import { UserService } from './user-service';

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }

  /**
   * Search with keyword or spatial for submission IDs
   *
   * @param {ISearchSubmissionCriteria} submissionCriteria
   * @return {*}  {Promise<{ submission_id: number }[]>}
   * @memberof SubmissionService
   */
  async findSubmissionByCriteria(submissionCriteria: ISearchSubmissionCriteria): Promise<{ submission_id: number }[]> {
    return this.submissionRepository.findSubmissionByCriteria(submissionCriteria);
  }

  /**
   * Insert a new submission record.
   *
   * @param {ISubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(submissionData: ISubmissionRecord): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecord(submissionData);
  }

  /**
   * Insert a new submission record, returning the record having the matching UUID if it already exists
   *
   * @param {ISubmissionModel} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecordWithPotentialConflict(
    submissionData: ISubmissionModel
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecordWithPotentialConflict(submissionData);
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordInputKey(submissionId: number, inputKey: string): Promise<{ submission_id: number }> {
    return this.submissionRepository.updateSubmissionRecordInputKey(submissionId, inputKey);
  }

  /**
   * Update the `eml_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {EMLFile} file
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataEMLSource(
    submissionId: number,
    submissionMetadataId: number,
    file: EMLFile
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLSource(submissionId, submissionMetadataId, file);
  }

  /**
   * Update the `eml_json_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {ISubmissionRecord['eml_json_source']} EMLJSONSource
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordEMLJSONSource(
    submissionId: number,
    submissionMetadataId: number,
    EMLJSONSource: ISubmissionMetadataRecord['eml_json_source']
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.updateSubmissionMetadataEMLJSONSource(
      submissionId,
      submissionMetadataId,
      EMLJSONSource
    );
  }

  /**
   * Get submission record by id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }

  /**
   * Get submission record by uuid.
   *
   * @param {number} uuid
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number } | null> {
    return this.submissionRepository.getSubmissionIdByUUID(uuid);
  }

  /**
   * Set record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEndDate(submissionId);
  }

  /**
   * Set record_effective_timestamp of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionMetadataRecordEffectiveDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionMetadataRecordEffectiveDate(submissionId);
  }

  /**
   * Update end time stamp for submission observation record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionService
   */
  async updateSubmissionObservationRecordEndDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionObservationRecordEndDate(submissionId);
  }

  /**
   * Update start time stamp for submission observation record
   *
   * @param {number} submissionId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionService
   */
  async updateSubmissionObservationRecordEffectiveDate(submissionId: number): Promise<number> {
    return this.submissionRepository.updateSubmissionObservationRecordEffectiveDate(submissionId);
  }

  /**
   * Get source transform record by its associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number, version?: string): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySystemUserId(systemUserId, version);
  }

  /**
   * Get json representation of eml source from submission.
   *
   * @param {number} submissionId
   * @param {string} transform
   * @return {string}
   * @memberof SubmissionService
   */
  async getSubmissionMetadataJson(submissionId: number, transform: string): Promise<string> {
    return this.submissionRepository.getSubmissionMetadataJson(submissionId, transform);
  }

  /**
   * Get source transform record by its associated source transform id.
   *
   * @param {number} sourceTransformId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySourceTransformId(sourceTransformId: number): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySourceTransformId(sourceTransformId);
  }

  /**
   * Get json representation of eml source from submission by datasetId.
   *
   * @param {string} datasetId
   * @return {string}
   * @memberof SubmissionService
   */
  async getSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<string> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get dataset', [
        'SubmissionRepository->getSubmissionRecordEMLJSONByDatasetId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Find json representation of eml source from submission by datasetId. May return null if `datasetId` does not match
   * any existing records.
   *
   * @param {string} datasetId
   * @return {string | null}
   * @memberof SubmissionService
   */
  async findSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<string | null> {
    const response = await this.submissionRepository.getSubmissionRecordEMLJSONByDatasetId(datasetId);

    if (response.rowCount !== 1) {
      return null;
    }

    return response.rows[0].eml_json_source;
  }

  /**
   * Insert a submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_status_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{
    submission_status_id: number;
    submission_status_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType);
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{
   *     submission_message_id: number;
   *     submission_message_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_message_id: number;
    submission_message_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionMessage(
      submissionStatusId,
      submissionMessageType,
      submissionMessage
    );
  }

  /**
   * List all submissions
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModelWithStatus>}
   * @memberof SubmissionService
   */
  async listSubmissionRecords(): Promise<ISubmissionModelWithStatus[]> {
    return this.submissionRepository.listSubmissionRecords();
  }

  /**
   * Returns Intake file from S3
   *
   * @param {string} s3FileLocation
   * @return {*}  {Promise<GetObjectOutput>}
   * @memberof SubmissionService
   */
  async getIntakeFileFromS3(s3FileLocation: string): Promise<GetObjectOutput> {
    return this.getFileFromS3(s3FileLocation);
  }

  /**
   * Collect filename from S3
   *
   * @param {string} fileName
   * @return {*}  {Promise<GetObjectOutput>}
   * @memberof SubmissionService
   */
  async getFileFromS3(fileName: string): Promise<GetObjectOutput> {
    const s3File = await getFileFromS3(fileName);

    if (!s3File) {
      throw new ApiGeneralError('Failed to get file from S3');
    }

    return s3File;
  }

  /**
   * Inserts both the status and message of a submission
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @param {string} submissionMessage
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_message_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatusAndMessage(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{
    submission_status_id: number;
    submission_message_id: number;
  }> {
    const submission_status_id = (
      await this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType)
    ).submission_status_id;

    const submission_message_id = (
      await this.submissionRepository.insertSubmissionMessage(
        submission_status_id,
        submissionMessageType,
        submissionMessage
      )
    ).submission_message_id;

    return {
      submission_status_id,
      submission_message_id
    };
  }

  /**
   * Retrieves an array of submission records with spatial count by dataset id.
   *
   * @param {string[]} datasetIds
   * @return {*}  {(Promise<(ISubmissionRecordWithSpatial | null)[]>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordsWithSpatialCount(datasetIds: string[]): Promise<(ISubmissionRecordWithSpatial | null)[]> {
    return Promise.all(datasetIds.map(async (datasetId) => this.findSubmissionRecordWithSpatialCount(datasetId)));
  }

  /**
   * Retrieves a submission record with spatial count by dataset id.
   *
   * @param {string} datasetId
   * @return {*}  {(Promise<ISubmissionRecordWithSpatial | null>)}
   * @memberof SubmissionService
   */
  async findSubmissionRecordWithSpatialCount(datasetId: string): Promise<ISubmissionRecordWithSpatial | null> {
    const userService = new UserService(this.connection);
    const [submissionEMLJSON, spatialComponentCounts] = await Promise.all([
      this.findSubmissionRecordEMLJSONByDatasetId(datasetId),
      (await userService.isSystemUserAdmin())
        ? this.submissionRepository.getSpatialComponentCountByDatasetIdAsAdmin(datasetId)
        : this.submissionRepository.getSpatialComponentCountByDatasetId(datasetId)
    ]);

    if (!submissionEMLJSON) {
      return null;
    }

    return {
      id: datasetId,
      source: submissionEMLJSON,
      observation_count: spatialComponentCounts.find((countItem) => countItem.spatial_type === 'Occurrence')?.count || 0
    };
  }

  /**
   *  Fetch row of submission job queue by submission Id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionJobQueue>}
   * @memberof SubmissionService
   */
  async getSubmissionJobQueue(submissionId: number): Promise<ISubmissionJobQueue> {
    return this.submissionRepository.getSubmissionJobQueue(submissionId);
  }

  /**
   * Update end time for the most recently stated record
   *
   * @param {number} submissionId
   * @return {*}
   * @memberof SubmissionService
   */
  async updateSubmissionJobQueueEndTime(submissionId: number) {
    return this.submissionRepository.updateSubmissionJobQueueEndTime(submissionId);
  }

  /**
   * Insert a new metadata record
   *
   * @param {ISubmissionMetadataRecord} submissonMetadata
   * @return {*}  {Promise<{ submission_metadata_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMetadataRecord(
    submissonMetadata: ISubmissionMetadataRecord
  ): Promise<{ submission_metadata_id: number }> {
    return this.submissionRepository.insertSubmissionMetadataRecord(submissonMetadata);
  }

  /**
   * Insert a new Observation Record
   *
   * @param {ISubmissionObservationRecord} submissonObservation
   * @return {*}  {Promise<{ submission_observation_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionObservationRecord(
    submissonObservation: ISubmissionObservationRecord
  ): Promise<{ submission_observation_id: number }> {
    return this.submissionRepository.insertSubmissionObservationRecord(submissonObservation);
  }
}
