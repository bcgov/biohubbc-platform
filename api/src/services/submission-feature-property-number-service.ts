import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumber
} from '../models/submission-feature-property-number';
import { SubmissionFeaturePropertyNumberRepository } from '../repositories/submission-feature-property-number-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyNumberService extends DBService {
  submissionFeaturePropertyNumberRepository: SubmissionFeaturePropertyNumberRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyNumberService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyNumberService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyNumberRepository = new SubmissionFeaturePropertyNumberRepository(connection);
  }

  /**
   * Create a submission_feature_property_number row.
   *
   * @param {CreateSubmissionFeaturePropertyNumber} payload
   * @return {Promise<SubmissionFeaturePropertyNumber>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  createSubmissionFeaturePropertyNumber(
    payload: CreateSubmissionFeaturePropertyNumber
  ): Promise<SubmissionFeaturePropertyNumber> {
    return this.submissionFeaturePropertyNumberRepository.insertSubmissionFeaturePropertyNumber(payload);
  }

  /**
   * Create submission_feature_property_number rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyNumber[]} payloads
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  createSubmissionFeaturePropertyNumbers(
    payloads: CreateSubmissionFeaturePropertyNumber[]
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    return this.submissionFeaturePropertyNumberRepository.insertSubmissionFeaturePropertyNumbers(payloads);
  }

  /**
   * Get a submission_feature_property_number row by id.
   *
   * @param {number} submissionFeaturePropertyNumberId
   * @return {Promise<SubmissionFeaturePropertyNumber>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  getSubmissionFeaturePropertyNumberById(
    submissionFeaturePropertyNumberId: number
  ): Promise<SubmissionFeaturePropertyNumber> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberById(
      submissionFeaturePropertyNumberId
    );
  }

  /**
   * Get submission_feature_property_number rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  getSubmissionFeaturePropertyNumberBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_number rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    return this.submissionFeaturePropertyNumberRepository.getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Delete submission_feature_property_number rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  deleteSubmissionFeaturePropertyNumbersBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyNumberRepository.deleteSubmissionFeaturePropertyNumbersBySubmissionId(
      submissionId
    );
  }

  /**
   * Delete submission_feature_property_number rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyNumberService
   */
  deleteSubmissionFeaturePropertyNumbersBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyNumberRepository.deleteSubmissionFeaturePropertyNumbersBySubmissionUploadId(
      submissionUploadId
    );
  }
}
