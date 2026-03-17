import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBoolean
} from '../models/submission-feature-property-boolean';
import { SubmissionFeaturePropertyBooleanRepository } from '../repositories/submission-feature-property-boolean-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyBooleanService extends DBService {
  submissionFeaturePropertyBooleanRepository: SubmissionFeaturePropertyBooleanRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyBooleanRepository = new SubmissionFeaturePropertyBooleanRepository(connection);
  }

  createSubmissionFeaturePropertyBoolean(
    payload: CreateSubmissionFeaturePropertyBoolean
  ): Promise<SubmissionFeaturePropertyBoolean> {
    return this.submissionFeaturePropertyBooleanRepository.insertSubmissionFeaturePropertyBoolean(payload);
  }

  getSubmissionFeaturePropertyBooleanById(
    submissionFeaturePropertyBooleanId: number
  ): Promise<SubmissionFeaturePropertyBoolean> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanById(
      submissionFeaturePropertyBooleanId
    );
  }

  getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }
}
