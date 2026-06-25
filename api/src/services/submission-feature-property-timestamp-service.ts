import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestamp
} from '../models/submission-feature-property-timestamp';
import { SubmissionFeaturePropertyTimestampRepository } from '../repositories/submission-feature-property-timestamp-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyTimestampService extends DBService {
  submissionFeaturePropertyTimestampRepository: SubmissionFeaturePropertyTimestampRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyTimestampRepository = new SubmissionFeaturePropertyTimestampRepository(connection);
  }

  createSubmissionFeaturePropertyTimestamp(
    payload: CreateSubmissionFeaturePropertyTimestamp
  ): Promise<SubmissionFeaturePropertyTimestamp> {
    return this.submissionFeaturePropertyTimestampRepository.insertSubmissionFeaturePropertyTimestamp(payload);
  }

  getSubmissionFeaturePropertyTimestampById(
    submissionFeaturePropertyTimestampId: number
  ): Promise<SubmissionFeaturePropertyTimestamp> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampById(
      submissionFeaturePropertyTimestampId
    );
  }

  getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  getSubmissionFeaturePropertyTimestampByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampByBlueprintFeatureTypePropertyId(
      blueprintFeatureTypePropertyId
    );
  }
}
