import { IDBConnection } from '../database/db';
import { SubmissionRepository } from '../repositories/submission-repository';
import { DBService } from './db-service';

export class DatasetService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }

  /**
   * Retrieves dataset data from the submission table.
   *
   * @param {string} datasetUUID
   * @return {*}  {Promise<any>}
   * @memberof DatasetService
   */
  async getDatasetByDatasetUUID(datasetUUID: string): Promise<any> {
    const submission = this.submissionRepository.getSubmissionByUUID(datasetUUID);
    console.log('submission', submission);

    return submission;
  }
}
