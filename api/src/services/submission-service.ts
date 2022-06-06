import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTP500 } from '../errors/http-error';
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
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('paths/dwc/validate');

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
   *
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISourceTransformModel['metadata_transform_precompile']>}
   * @memberof SubmissionService
   */
  async getEMLStyleSheetKey(submissionId: number): Promise<ISourceTransformModel['transform_precompile_key']> {
    return await (
      await this.submissionRepository.getSourceTransformIdBySubmissionId(submissionId)
    ).transform_precompile_key;
  }

  async getStylesheetFromS3(submissionId: number): Promise<any> {
    try {
      const stylesheet_key = await this.getEMLStyleSheetKey(submissionId);

      if (!stylesheet_key) {
        throw new ApiExecuteSQLError('Failed to retrieve stylesheet key', [
          'SubmissionRepository->getStyleSheetKey',
          'stylesheet_key was null'
        ]);
      }

      const s3File = await getFileFromS3(stylesheet_key);

      if (!s3File) {
        throw new HTTP500('Failed to get file from S3');
      }
      return s3File;
    } catch (error) {
      defaultLog.error({ label: 'getS3File', message: 'error', error });
      throw error;
    }
  }
}
