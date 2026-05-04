import { IDBConnection } from '../database/db';
import { PropertySearchRepository } from '../repositories/property-search-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { GroupedPropertyResults, ISearchPropertyFilters } from './property-search-service.interface';

const defaultLog = getLogger('services/property-search-service');

/**
 * Service for searching feature properties.
 * Delegates to PropertySearchRepository for all database operations.
 */
export class PropertySearchService extends DBService {
  searchRepository: PropertySearchRepository;

  /**
   * Initializes the PropertySearchService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   * @memberof PropertySearchService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.searchRepository = new PropertySearchRepository(connection);
  }

  /**
   * Searches properties by filters with results grouped by type.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria for property search
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @return {Promise<GroupedPropertyResults>} Property results grouped by type (string, number)
   * @public
   * @memberof PropertySearchService
   */
  async searchProperty(
    filters: ISearchPropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<GroupedPropertyResults> {
    defaultLog.debug({ label: 'searchProperty', filters, pagination });

    const results = await this.searchRepository.searchProperties(filters, pagination);

    return {
      string: results.filter((result) => result.feature_property_type === 'string'),
      number: results.filter((result) => result.feature_property_type === 'number'),
      boolean: results.filter((result) => result.feature_property_type === 'boolean'),
      datetime: results.filter((result) => result.feature_property_type === 'datetime'),
      taxon: results.filter((result) => result.feature_property_type === 'taxon'),
      spatial: results.filter((result) => result.feature_property_type === 'spatial'),
      code: results.filter((result) => result.feature_property_type === 'code')
    };
  }

  /**
   * Returns the total count of properties matching the search filters.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria for property search
   * @return {Promise<number>} Total count of matching properties across all types
   * @public
   * @memberof PropertySearchService
   */
  async getSearchPropertyCount(filters: ISearchPropertyFilters): Promise<number> {
    defaultLog.debug({ label: 'getSearchPropertyCount', filters });

    return this.searchRepository.searchPropertiesCount(filters);
  }
}
