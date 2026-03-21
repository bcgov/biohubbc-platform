import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyString,
  SubmissionFeaturePropertyString
} from '../models/submission-feature-property-string';
import { SubmissionFeaturePropertyStringRepository } from '../repositories/submission-feature-property-string-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyStringService extends DBService {
  submissionFeaturePropertyStringRepository: SubmissionFeaturePropertyStringRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyStringService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyStringService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyStringRepository = new SubmissionFeaturePropertyStringRepository(connection);
  }

  /**
   * Create a submission_feature_property_string row.
   *
   * @param {CreateSubmissionFeaturePropertyString} payload
   * @return {Promise<SubmissionFeaturePropertyString>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  createSubmissionFeaturePropertyString(
    payload: CreateSubmissionFeaturePropertyString
  ): Promise<SubmissionFeaturePropertyString> {
    return this.submissionFeaturePropertyStringRepository.insertSubmissionFeaturePropertyString(payload);
  }

  /**
   * Create submission_feature_property_string rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyString[]} payloads
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  createSubmissionFeaturePropertyStrings(
    payloads: CreateSubmissionFeaturePropertyString[]
  ): Promise<SubmissionFeaturePropertyString[]> {
    return this.submissionFeaturePropertyStringRepository.insertSubmissionFeaturePropertyStrings(payloads);
  }

  /**
   * Get a submission_feature_property_string row by id.
   *
   * @param {number} submissionFeaturePropertyStringId
   * @return {Promise<SubmissionFeaturePropertyString>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  getSubmissionFeaturePropertyStringById(
    submissionFeaturePropertyStringId: number
  ): Promise<SubmissionFeaturePropertyString> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringById(
      submissionFeaturePropertyStringId
    );
  }

  /**
   * Get submission_feature_property_string rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  getSubmissionFeaturePropertyStringBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_string rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  getSubmissionFeaturePropertyStringByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    return this.submissionFeaturePropertyStringRepository.getSubmissionFeaturePropertyStringByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_string rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  deleteSubmissionFeaturePropertyStringsBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyStringRepository.deleteSubmissionFeaturePropertyStringsBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_string rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyStringService
   */
  deleteSubmissionFeaturePropertyStringsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyStringRepository.deleteSubmissionFeaturePropertyStringsBySubmissionUploadId(
      submissionUploadId
    );
  }
}
