import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import {
  IInsertSubmissionRecord,
  ISearchSubmissionCriteria,
  ISourceTransformModel,
  ISubmissionModel,
  ISubmissionModelWithStatus,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { getFileFromS3 } from '../utils/file-utils';
import { DBService } from './db-service';

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
   * @param {IInsertSubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(submissionData: IInsertSubmissionRecord): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecord(submissionData);
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordInputKey(
    submissionId: number,
    inputKey: IInsertSubmissionRecord['input_key']
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.updateSubmissionRecordInputKey(submissionId, inputKey);
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
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number }> {
    return this.submissionRepository.getSubmissionIdByUUID(uuid);
  }

  /**
   * Set record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async setSubmissionIdEndDate(submissionId: number): Promise<{ submission_id: number }> {
    return this.submissionRepository.setSubmissionIdEndDate(submissionId);
  }

  /**
   * Get source transform record by its associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionService
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number): Promise<ISourceTransformModel> {
    return this.submissionRepository.getSourceTransformRecordBySystemUserId(systemUserId);
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
   * Gets the S3key of the EMLStyleSheet from the DB.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<string>}
   * @memberof SubmissionService
   */
  async getEMLStyleSheetKey(submissionId: number): Promise<string> {
    const transformRecord = await this.submissionRepository.getSourceTransformRecordBySubmissionId(submissionId);

    if (!transformRecord.transform_precompile_key) {
      throw new ApiGeneralError('Failed to retrieve stylesheet key', [
        'SubmissionRepository->getStyleSheetKey',
        'stylesheet_key was null'
      ]);
    }

    return transformRecord.transform_precompile_key;
  }

  /**
   * Returns the EML stylesheet from S3
   *
   * @param {number} submissionId
   * @return {*}  {Promise<GetObjectOutput>}
   * @memberof SubmissionService
   */
  async getStylesheetFromS3(submissionId: number): Promise<GetObjectOutput> {
    const stylesheet_key = await this.getEMLStyleSheetKey(submissionId);

    const s3File = await getFileFromS3(stylesheet_key);

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
   *  Update darwin_core_source field in submission table
   *
   * @param {number} submissionId
   * @param {string} normalizedData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordDWCSource(
    submissionId: number,
    normalizedData: string
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.updateSubmissionRecordDWCSource(submissionId, normalizedData);
  }
}
