import { IDBConnection } from '../database/db';
import { SubmissionFeatureProperty } from '../models/feature-property';
import { SubmissionFeaturePropertyFilters } from '../models/submission-feature';
import { SubmissionFeaturePropertyRepository } from '../repositories/submission-feature-property-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for reading canonical indexed properties attached to submission features.
 *
 * @export
 * @class SubmissionFeaturePropertyService
 * @extends {DBService}
 */
export class SubmissionFeaturePropertyService extends DBService {
  submissionFeaturePropertyRepository: SubmissionFeaturePropertyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(connection);
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
}
