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

  /**
   * Create submission_feature_property_timestamp rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp[]} payloads
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  createSubmissionFeaturePropertyTimestamps(
    payloads: CreateSubmissionFeaturePropertyTimestamp[]
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    return this.submissionFeaturePropertyTimestampRepository.insertSubmissionFeaturePropertyTimestamps(payloads);
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

  getSubmissionFeaturePropertyTimestampByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_timestamp rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  deleteSubmissionFeaturePropertyTimestampsBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyTimestampRepository.deleteSubmissionFeaturePropertyTimestampsBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_timestamp rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  deleteSubmissionFeaturePropertyTimestampsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyTimestampRepository.deleteSubmissionFeaturePropertyTimestampsBySubmissionUploadId(
      submissionUploadId
    );
  }
}
