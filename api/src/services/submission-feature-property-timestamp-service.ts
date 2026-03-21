import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestamp
} from '../models/submission-feature-property-timestamp';
import { SubmissionFeaturePropertyTimestampRepository } from '../repositories/submission-feature-property-timestamp-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyTimestampService extends DBService {
  submissionFeaturePropertyTimestampRepository: SubmissionFeaturePropertyTimestampRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyTimestampService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyTimestampRepository = new SubmissionFeaturePropertyTimestampRepository(connection);
  }

  /**
   * Create a submission_feature_property_timestamp row.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp} payload
   * @return {Promise<SubmissionFeaturePropertyTimestamp>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
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

  /**
   * Get a submission_feature_property_timestamp row by id.
   *
   * @param {number} submissionFeaturePropertyTimestampId
   * @return {Promise<SubmissionFeaturePropertyTimestamp>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  getSubmissionFeaturePropertyTimestampById(
    submissionFeaturePropertyTimestampId: number
  ): Promise<SubmissionFeaturePropertyTimestamp> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampById(
      submissionFeaturePropertyTimestampId
    );
  }

  /**
   * Get submission_feature_property_timestamp rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
  getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    return this.submissionFeaturePropertyTimestampRepository.getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_timestamp rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampService
   */
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
