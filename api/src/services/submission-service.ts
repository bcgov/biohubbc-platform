import { IDBConnection } from '../database/db';
import { IInsertSubmissionRecord, ISubmissionModel, SubmissionRepository } from '../repositories/submission-repository';
import { DBService } from './db-service';

export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(this.connection);
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
    if (submissionId === 2) {
      return {
        submission_id: 1,
        source: '',
        uuid: 'string',
        event_timestamp: 'string',
        delete_timestamp: '',
        input_key: 'platform/test/csv.zip',
        input_file_name: '',
        eml_source: '',
        darwin_core_source: '',
        create_date: 'string',
        create_user: 3,
        update_date: '',
        update_user: 0,
        revision_count: 1
      };
    } //TODO REMOVE. THIS ITS FOR TESTIHF
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }
}
