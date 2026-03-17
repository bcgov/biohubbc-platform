import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCode
} from '../models/submission-feature-property-code';
import { SubmissionFeaturePropertyCodeRepository } from '../repositories/submission-feature-property-code-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyCodeService extends DBService {
  submissionFeaturePropertyCodeRepository: SubmissionFeaturePropertyCodeRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyCodeRepository = new SubmissionFeaturePropertyCodeRepository(connection);
  }

  createSubmissionFeaturePropertyCode(
    payload: CreateSubmissionFeaturePropertyCode
  ): Promise<SubmissionFeaturePropertyCode> {
    return this.submissionFeaturePropertyCodeRepository.insertSubmissionFeaturePropertyCode(payload);
  }

  getSubmissionFeaturePropertyCodeById(
    submissionFeaturePropertyCodeId: number
  ): Promise<SubmissionFeaturePropertyCode> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodeById(
      submissionFeaturePropertyCodeId
    );
  }

  getSubmissionFeaturePropertyCodeBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodeBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyCodeByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodeByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }
}
