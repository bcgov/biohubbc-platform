import { IDBConnection } from '../database/db';
import { SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters } from '../models/submission-feature';
import { SubmissionFeatureRepository } from '../repositories/submission-feature-repository';
import {
  RelatedSubmissionFeature,
  SubmissionFeature,
  SubmissionFeatureRecord
} from '../repositories/submission-repository';
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
    await this.submissionFeatureRepository.getSubmissionFeatureById(submissionFeatureId);
    const [properties, total] = await Promise.all([
      this.submissionFeatureRepository.getSubmissionFeatureProperties(submissionFeatureId, pagination, filters),
      this.submissionFeatureRepository.getSubmissionFeaturePropertiesCount(submissionFeatureId, filters)
    ]);

    return { properties, total };
  }
}
