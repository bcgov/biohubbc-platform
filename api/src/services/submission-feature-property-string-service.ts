import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyString,
  SubmissionFeaturePropertyString
} from '../models/submission-feature-property-string';
import { SubmissionFeaturePropertyStringRepository } from '../repositories/submission-feature-property-string-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyStringService extends DBService {
  submissionFeaturePropertyStringRepository: SubmissionFeaturePropertyStringRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyStringRepository = new SubmissionFeaturePropertyStringRepository(connection);
  }

  createSubmissionFeaturePropertyString(
    payload: CreateSubmissionFeaturePropertyString
  ): Promise<SubmissionFeaturePropertyString> {
    return this.submissionFeaturePropertyStringRepository.insertSubmissionFeaturePropertyString(payload);
  }

  getSubmissionFeaturePropertyStringById(
    submissionFeaturePropertyStringId: number
  ): Promise<SubmissionFeaturePropertyString> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringById(
      submissionFeaturePropertyStringId
    );
  }

  getSubmissionFeaturePropertyStringBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyStringByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringByBlueprintFeatureTypePropertyId(
      blueprintFeatureTypePropertyId
    );
  }
}
