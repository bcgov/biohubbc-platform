import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumber
} from '../models/submission-feature-property-number';
import { SubmissionFeaturePropertyNumberRepository } from '../repositories/submission-feature-property-number-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyNumberService extends DBService {
  submissionFeaturePropertyNumberRepository: SubmissionFeaturePropertyNumberRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyNumberRepository = new SubmissionFeaturePropertyNumberRepository(connection);
  }

  createSubmissionFeaturePropertyNumber(
    payload: CreateSubmissionFeaturePropertyNumber
  ): Promise<SubmissionFeaturePropertyNumber> {
    return this.submissionFeaturePropertyNumberRepository.insertSubmissionFeaturePropertyNumber(payload);
  }

  getSubmissionFeaturePropertyNumberById(
    submissionFeaturePropertyNumberId: number
  ): Promise<SubmissionFeaturePropertyNumber> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberById(
      submissionFeaturePropertyNumberId
    );
  }

  getSubmissionFeaturePropertyNumberBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }
}
