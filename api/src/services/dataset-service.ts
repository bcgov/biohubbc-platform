import { IDBConnection } from '../database/db';
import { SubmissionRepository } from '../repositories/submission-repository';
import { DBService } from './db-service';

export class DatasetService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }
}
