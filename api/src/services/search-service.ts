import { IDBConnection } from '../database/db';
import { SearchSummaryResponse, SearchTaxonResult } from '../models/search';
import { SearchRepository } from '../repositories/search-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { SearchParams, SearchResponseWithCounts, SearchTaxonFilters, WithCount } from './search-service.interface';

export class SearchService extends DBService {
  searchRepository: SearchRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.searchRepository = new SearchRepository(connection);
  }

  /**
   * Search all features, submissions, and taxonomy with independent pagination.
   *
   * @param {SearchParams} params
   * @param {ApiPaginationOptions} pagination
   * @returns {Promise<SearchResponseWithCounts>}
   */
  async search(params: SearchParams, pagination?: ApiPaginationOptions): Promise<SearchResponseWithCounts> {
    const [features, submissions, taxonomy] = await Promise.all([
      this.searchRepository.findFeatures(params, pagination),
      this.searchRepository.findSubmissions(params, pagination),
      this.searchRepository.findTaxon({ keyword: params.keyword }, pagination)
    ]);

    return { features, submissions, taxonomy };
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
   * @param {SearchParams} params
   * @returns {Promise<SearchSummaryResponse>}
   */
  async getSearchSummary(params: SearchParams): Promise<SearchSummaryResponse> {
    const [features, submissions, taxonomy] = await Promise.all([
      this.searchRepository.findFeatureSummary(params),
      this.searchRepository.findSubmissionSummary(params),
      this.searchRepository.findTaxonSummary(params)
    ]);

    return { features, submissions, taxonomy };
  }
}
