import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCode
} from '../models/submission-feature-property-code';
import { SubmissionFeaturePropertyCodeRepository } from '../repositories/submission-feature-property-code-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyCodeService extends DBService {
  submissionFeaturePropertyCodeRepository: SubmissionFeaturePropertyCodeRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyCodeService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyCodeService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyCodeRepository = new SubmissionFeaturePropertyCodeRepository(connection);
  }

  /**
   * Create a submission_feature_property_code row.
   *
   * @param {CreateSubmissionFeaturePropertyCode} payload
   * @return {Promise<SubmissionFeaturePropertyCode>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  createSubmissionFeaturePropertyCode(
    payload: CreateSubmissionFeaturePropertyCode
  ): Promise<SubmissionFeaturePropertyCode> {
    return this.submissionFeaturePropertyCodeRepository.insertSubmissionFeaturePropertyCode(payload);
  }

  /**
   * Create submission_feature_property_code rows in bulk.
   *
   * @param {CreateSubmissionFeaturePropertyCode[]} payloads
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  createSubmissionFeaturePropertyCodes(
    payloads: CreateSubmissionFeaturePropertyCode[]
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.insertSubmissionFeaturePropertyCodes(payloads);
  }

  /**
   * Get a submission_feature_property_code row by id.
   *
   * @param {number} submissionFeaturePropertyCodeId
   * @return {Promise<SubmissionFeaturePropertyCode>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  getSubmissionFeaturePropertyCodeById(
    submissionFeaturePropertyCodeId: number
  ): Promise<SubmissionFeaturePropertyCode> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodeById(
      submissionFeaturePropertyCodeId
    );
  }

  /**
   * Get submission_feature_property_code rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  getSubmissionFeaturePropertyCodesBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodesBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_code rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  getSubmissionFeaturePropertyCodesByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodesByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Get submission_feature_property_code rows by contributor_codeset_code id.
   *
   * @param {number} contributorCodesetCodeId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  getSubmissionFeaturePropertyCodesByContributorCodesetCodeId(
    contributorCodesetCodeId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodesByContributorCodesetCodeId(
      contributorCodesetCodeId
    );
  }

  /**
   * Delete submission_feature_property_code rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  deleteSubmissionFeaturePropertyCodesBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeaturePropertyCodeRepository.deleteSubmissionFeaturePropertyCodesBySubmissionId(submissionId);
  }

  /**
   * Delete submission_feature_property_code rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  deleteSubmissionFeaturePropertyCodesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeaturePropertyCodeRepository.deleteSubmissionFeaturePropertyCodesBySubmissionUploadId(
      submissionUploadId
    );
  }
}
