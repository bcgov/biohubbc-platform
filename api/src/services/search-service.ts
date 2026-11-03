import { IDBConnection } from '../database/db';
import { SearchSummaryResponse, SearchTaxonResult } from '../models/search';
import { SearchRepository } from '../repositories/search-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { SearchParams, SearchTaxonFilters, WithCount } from './search-service.interface';

export class SearchService extends DBService {
  searchRepository: SearchRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.searchRepository = new SearchRepository(connection);
  }

  /**
   * Search local taxonomy rows with pagination.
   *
   * @param {SearchTaxonFilters} filters
   * @param {ApiPaginationOptions} pagination
   * @returns {Promise<WithCount<SearchTaxonResult>>}
   */
  async findTaxon(
    filters: SearchTaxonFilters,
    pagination?: ApiPaginationOptions
  ): Promise<WithCount<SearchTaxonResult>> {
    return this.searchRepository.findTaxon(filters, pagination);
  }

  /**
   * Get a summary count of features, submissions, and taxa grouped by type.
   *
   * Feature counts include only current features the caller can access.
   *
   * @param {SearchParams} params Search keyword.
   * @param {number | null} systemUserId Caller identity, or null for anonymous (unsecured features only).
   * @returns {Promise<SearchSummaryResponse>} Feature, submission, and taxonomy counts.
   */
  async getSearchSummary(params: SearchParams, systemUserId: number | null): Promise<SearchSummaryResponse> {
    const [features, submissions, taxonomy] = await Promise.all([
      this.searchRepository.findFeatureSummary(params, systemUserId),
      this.searchRepository.findSubmissionSummary(params),
      this.searchRepository.findTaxonSummary(params)
    ]);

    return { features, submissions, taxonomy };
  }
}
