import { IDBConnection } from '../database/db';
import { PropertySearchRepository } from '../repositories/property-search-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { GroupedPropertyResults, ISearchPropertyFilters } from './property-search-service.interface';

const defaultLog = getLogger('services/property-search-service');

/**
 * Service for searching properties across all searchable tables.
 * Delegates to PropertySearchRepository for all database operations.
 * Combines string and number property results using Promise.all.
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
   * Executes parallel searches for string and number properties, then combines
   * results into a GroupedPropertyResults object organized by value type.
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

    const [stringResults, numberResults] = await Promise.all([
      this.searchRepository.searchStringProperties(filters, pagination),
      this.searchRepository.searchNumberProperties(filters, pagination)
    ]);

    return {
      string: stringResults,
      number: numberResults
    };
  }

  /**
   * Returns the total count of properties matching the search filters.
   *
   * Executes parallel count queries for string and number properties,
   * then returns the combined total.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria for property search
   * @return {Promise<number>} Total count of matching properties across all types
   * @public
   * @memberof PropertySearchService
   */
  async getSearchPropertyCount(filters: ISearchPropertyFilters): Promise<number> {
    defaultLog.debug({ label: 'getSearchPropertyCount', filters });

    const [stringCount, numberCount] = await Promise.all([
      this.searchRepository.searchStringPropertiesCount(filters),
      this.searchRepository.searchNumberPropertiesCount(filters)
    ]);

    return stringCount + numberCount;
  }
}
