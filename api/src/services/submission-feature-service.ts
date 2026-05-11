import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters, SubmissionFeatureSignedUrlPayload } from '../models/submission-feature';
import { SubmissionFeatureRepository } from '../repositories/submission-feature-repository';
import {
  RelatedSubmissionFeature,
  SubmissionFeature,
  SubmissionFeatureRecord
} from '../repositories/submission-repository';
import { getS3SignedURL } from '../utils/file-utils';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for submission-feature scoped operations.
 *
 * @export
 * @class SubmissionFeatureService
 * @extends {DBService}
 */
export class SubmissionFeatureService extends DBService {
  submissionFeatureRepository: SubmissionFeatureRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureRepository = new SubmissionFeatureRepository(connection);
  }

  /**
   * Publish active features from a submission upload by setting record_effective_date.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureService
   */
  async setRecordEffectiveDateBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeatureRepository.setRecordEffectiveDateBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Reject active features from a submission upload by setting record_end_date.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureService
   */
  async setRecordEndDateBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeatureRepository.setRecordEndDateBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Reset publication/rejection dates for features from a submitted upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureService
   */
  async unsetRecordDatesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeatureRepository.unsetRecordDatesBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionFeatureUuid
   * @returns {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureByUuid(submissionFeatureUuid: string): Promise<SubmissionFeatureRecord> {
    return this.submissionFeatureRepository.getSubmissionFeatureByUuid(submissionFeatureUuid);
  }

  /**
   * Get a submission feature record by id.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<SubmissionFeature>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureById(submissionFeatureId: number): Promise<SubmissionFeature> {
    return this.submissionFeatureRepository.getSubmissionFeatureById(submissionFeatureId);
  }

  /**
   * Get all related submission features with their type names.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<RelatedSubmissionFeature[]>}
   * @memberof SubmissionFeatureService
   */
  async getRelatedSubmissionFeatures(submissionFeatureId: number): Promise<RelatedSubmissionFeature[]> {
    return this.submissionFeatureRepository.getRelatedSubmissionFeatures(submissionFeatureId);
  }

  /**
   * Get paginated, searchable feature properties for a single submission feature.
   *
   * @param {number} submissionFeatureId
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<{ properties: SubmissionFeatureProperty[]; total: number }>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureProperties(
    submissionFeatureId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<{ properties: SubmissionFeatureProperty[]; total: number }> {
    const [properties, total] = await Promise.all([
      this.submissionFeatureRepository.getSubmissionFeatureProperties(submissionFeatureId, pagination, filters),
      this.submissionFeatureRepository.getSubmissionFeaturePropertiesCount(submissionFeatureId, filters)
    ]);

    return { properties, total };
  }

  /**
   * Generate a signed URL for a submission feature artifact key.
   *
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @returns {Promise<string>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureSignedUrl(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const artifactKey = payload.isAdmin
      ? await this.submissionFeatureRepository.getAdminSubmissionFeatureArtifactKey(payload)
      : await this.submissionFeatureRepository.getSubmissionFeatureArtifactKey(payload);

    const signedUrl = await getS3SignedURL(artifactKey);

    if (!signedUrl) {
      throw new ApiGeneralError(
        `Failed to generate signed URL for "${payload.submissionFeatureObj.key}":"${payload.submissionFeatureObj.value}"`,
        ['SubmissionFeatureRepository->getSubmissionFeatureSignedUrl', 'getS3SignedUrl returned NULL']
      );
    }

    return signedUrl;
  }
}
