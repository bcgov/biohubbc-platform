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
   * Get submission_feature_property_code rows by blueprint feature type property id.
   *
   * @param {number} blueprintFeatureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeService
   */
  getSubmissionFeaturePropertyCodesByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    return this.submissionFeaturePropertyCodeRepository.getSubmissionFeaturePropertyCodesByBlueprintFeatureTypePropertyId(
      blueprintFeatureTypePropertyId
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
}
