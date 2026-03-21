import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBoolean
} from '../models/submission-feature-property-boolean';
import { SubmissionFeaturePropertyBooleanRepository } from '../repositories/submission-feature-property-boolean-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyBooleanService extends DBService {
  submissionFeaturePropertyBooleanRepository: SubmissionFeaturePropertyBooleanRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyBooleanService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyBooleanRepository = new SubmissionFeaturePropertyBooleanRepository(connection);
  }

  /**
   * Create a submission_feature_property_boolean row.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean} payload
   * @return {Promise<SubmissionFeaturePropertyBoolean>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  createSubmissionFeaturePropertyBoolean(
    payload: CreateSubmissionFeaturePropertyBoolean
  ): Promise<SubmissionFeaturePropertyBoolean> {
    return this.submissionFeaturePropertyBooleanRepository.insertSubmissionFeaturePropertyBoolean(payload);
  }

  /**
   * Create submission_feature_property_boolean rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean[]} payloads
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  createSubmissionFeaturePropertyBooleans(
    payloads: CreateSubmissionFeaturePropertyBoolean[]
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    return this.submissionFeaturePropertyBooleanRepository.insertSubmissionFeaturePropertyBooleans(payloads);
  }

  /**
   * Get a submission_feature_property_boolean row by id.
   *
   * @param {number} submissionFeaturePropertyBooleanId
   * @return {Promise<SubmissionFeaturePropertyBoolean>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  getSubmissionFeaturePropertyBooleanById(
    submissionFeaturePropertyBooleanId: number
  ): Promise<SubmissionFeaturePropertyBoolean> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanById(
      submissionFeaturePropertyBooleanId
    );
  }

  /**
   * Get submission_feature_property_boolean rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_boolean rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    return this.submissionFeaturePropertyBooleanRepository.getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_boolean rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  deleteSubmissionFeaturePropertyBooleansBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyBooleanRepository.deleteSubmissionFeaturePropertyBooleansBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_boolean rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyBooleanService
   */
  deleteSubmissionFeaturePropertyBooleansBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyBooleanRepository.deleteSubmissionFeaturePropertyBooleansBySubmissionUploadId(
      submissionUploadId
    );
  }
}
