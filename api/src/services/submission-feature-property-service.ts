import { IDBConnection } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FeatureProperty, SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters } from '../models/submission-feature';
import { FeaturePropertyRepository } from '../repositories/feature-property-repository';
import { SubmissionFeaturePropertyRepository } from '../repositories/submission-feature-property-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

/**
 * Service for reading canonical indexed properties attached to submission features.
 *
 * @export
 * @class SubmissionFeaturePropertyService
 * @extends {DBService}
 */
export class SubmissionFeaturePropertyService extends DBService {
  submissionFeaturePropertyRepository: SubmissionFeaturePropertyRepository;
  featurePropertyRepository: FeaturePropertyRepository;
  submissionUploadService: SubmissionUploadService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.featurePropertyRepository = new FeaturePropertyRepository(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
    this.submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(connection);
  }

  /**
   * Read unique property definitions for a feature type across a reviewed upload.
   * @param {number} submissionId Owning submission from the request path.
   * @param {string} submissionUploadId Reviewed upload.
   * @param {string} featureType Canonical feature type name.
   * @returns {Promise<FeatureProperty[]>} Definitions present in the upload's stored values.
   * @throws {ApiNotFoundError} When the upload belongs to another submission.
   */
  async getSubmissionUploadFeatureTypeProperties(
    submissionId: number,
    submissionUploadId: string,
    featureType: string
  ): Promise<FeatureProperty[]> {
    const upload = await this.submissionUploadService.getSubmissionUpload(submissionUploadId);
    if (upload.submission_id !== submissionId) {
      throw new ApiNotFoundError('Submission upload not found');
    }
    return this.featurePropertyRepository.getSubmissionUploadFeatureTypeProperties(
      submissionId,
      submissionUploadId,
      featureType
    );
  }

  /**
   * Get paginated, searchable feature properties for a single published submission feature.
   *
   * @param {number} submissionFeatureId
   * @param {ApiPaginationOptions} pagination
   * @param {SubmissionFeaturePropertyFilters} [filters]
   * @returns {Promise<{ properties: SubmissionFeatureProperty[]; total: number }>}
   * @memberof SubmissionFeaturePropertyService
   */
  async getSubmissionFeatureProperties(
    submissionFeatureId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<{ properties: SubmissionFeatureProperty[]; total: number }> {
    const [properties, total] = await Promise.all([
      this.submissionFeaturePropertyRepository.getSubmissionFeatureProperties(submissionFeatureId, pagination, filters),
      this.submissionFeaturePropertyRepository.getSubmissionFeaturePropertiesCount(submissionFeatureId, filters)
    ]);

    return { properties, total };
  }

  /**
   * Get paginated, searchable properties for a feature belonging to a submission upload.
   *
   * @param {string} submissionUploadId UUID of the submission upload that owns the feature.
   * @param {number} submissionFeatureId ID of the submission feature whose properties should be returned.
   * @param {ApiPaginationOptions} pagination Pagination and sorting parameters.
   * @param {SubmissionFeaturePropertyFilters} [filters] Optional property search filters.
   * @returns {Promise<{ properties: SubmissionFeatureProperty[]; total: number }>} Paginated properties and total count.
   * @memberof SubmissionFeaturePropertyService
   */
  async getSubmissionFeaturePropertiesBySubmissionUploadId(
    submissionUploadId: string,
    submissionFeatureId: number,
    pagination: ApiPaginationOptions,
    filters?: SubmissionFeaturePropertyFilters
  ): Promise<{ properties: SubmissionFeatureProperty[]; total: number }> {
    const [properties, total] = await Promise.all([
      this.submissionFeaturePropertyRepository.getSubmissionFeaturePropertiesBySubmissionUploadId(
        submissionUploadId,
        submissionFeatureId,
        pagination,
        filters
      ),
      this.submissionFeaturePropertyRepository.getSubmissionFeaturePropertiesCountBySubmissionUploadId(
        submissionUploadId,
        submissionFeatureId,
        filters
      )
    ]);

    return { properties, total };
  }
}
