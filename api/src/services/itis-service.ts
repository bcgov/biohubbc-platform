import axios from 'axios';
import { getItisTaxonCommonNames, sortTaxonSearchResults } from '../utils/itis-utils';
import { getLogger } from '../utils/logger';
import { TaxonSearchResult } from './taxonomy-service';

const defaultLog = getLogger('services/itis-service');

export type ItisSolrSearchResponse = {
  commonNames?: string[];
  kingdom: string;
  name: string;
  parentTSN: string;
  scientificName: string;
  tsn: string;
  updateDate: string;
  usage: string;
  rank: string;
};

export type ItisSolrSearchResponseHierarchy = {
  tsn: string;
  hierarchyTSN: [string]; // Array with one item
};

export type TSNWithHierarchy = {
  tsn: number;
  hierarchy: number[];
};

/**
 * Generic base type for the ITIS Solr service
 */
type ItisSolrResponseBase<T> = {
  response: {
    docs: T;
  };
};

/**
 * Service for retrieving and processing taxonomic data from the Integrated Taxonomic Information System (ITIS).
 *
 * @See https://itis.gov
 *
 * @export
 * @class ItisService
 */
export class ItisService {
  /**
   * Returns the ITIS search species Query.
   *
   * @param {string[]} searchTerms
   * @return {*}  {Promise<TaxonSearchResult[]>}
   * @memberof ItisService
   */
  async searchItisByTerm(searchTerms: string[]): Promise<TaxonSearchResult[]> {
    const url = await this.getItisSolrTermSearchUrl(searchTerms);

    defaultLog.debug({ label: 'searchItisByTerm', message: 'url', url });

    const response = await axios.get<ItisSolrResponseBase<ItisSolrSearchResponse[]>>(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    const sanitizedResponse = this._sanitizeItisData(response.data.response.docs);

    // Sort the results to place exact matches at the top
    const sortedResponse = sortTaxonSearchResults(sanitizedResponse, searchTerms);

    // Return only a subset of the records
    // More records than are returned here are requested from ITIS to help find and prioritize exact matches
    return sortedResponse.slice(0, 15);
  }

  /**
   * Returns the ITIS search by TSN.
   *
   * @param {number[]} searchTsnIds
   * @return {*}  {Promise<ItisSolrSearchResponse[]>}
   * @memberof ItisService
   */
  async searchItisByTSN(searchTsnIds: number[]): Promise<ItisSolrSearchResponse[]> {
    const url = await this.getItisSolrTsnSearchUrl(searchTsnIds);

    defaultLog.debug({ label: 'searchItisByTSN', message: 'url', url });

    const response = await axios.get<ItisSolrResponseBase<ItisSolrSearchResponse[]>>(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return response.data.response.docs;
  }

  /**
   * Returns the parent hierarchy for multiple TSNs
   *
   * @param {number[]} tsnIds
   * @return {*}  {Promise<TSNWithHierarchy[]>}
   * @memberof ItisService
   */
  async getHierarchyForTSNs(tsnIds: number[]): Promise<TSNWithHierarchy[]> {
    const url = this.getItisSolrTsnHierarchyUrl(tsnIds);

    defaultLog.debug({ label: 'getHierarchyForTSNs', message: 'url', url });

    const response = await axios.get<ItisSolrResponseBase<ItisSolrSearchResponseHierarchy[]>>(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return this._sanitizeHierarchyData(response.data.response.docs);
  }

  /**
   * Cleans up the ITIS search response data
   *
   * @param {ItisSolrSearchResponse[]} data
   * @return {*}  {Promise<TaxonSearchResult[]>}
   * @memberof ItisService
   */
  _sanitizeItisData = (data: ItisSolrSearchResponse[]): TaxonSearchResult[] => {
    return data.map((item: ItisSolrSearchResponse) => {
      const commonNames = getItisTaxonCommonNames(item.commonNames);

      return {
        tsn: Number(item.tsn),
        commonNames: commonNames,
        scientificName: item.scientificName,
        rank: item.rank,
        kingdom: item.kingdom
      };
    });
  };

  /**
   * Cleans up the ITIS hierarchy response data
   *
   * @param {ItisSolrSearchResponse[]} data
   * @return {TSNWithHierarchy[]}
   * @memberof ItisService
   */
  _sanitizeHierarchyData = (data: ItisSolrSearchResponseHierarchy[]): TSNWithHierarchy[] => {
    return data.map((item: ItisSolrSearchResponseHierarchy) => ({
      tsn: Number(item.tsn),
      hierarchy: item.hierarchyTSN[0]
        .split('$')
        .filter((part) => part !== '')
        .map((tsn) => Number(tsn))
    }));
  };

  /**
   * Get the ITIS SORL search-by-term URL.
   *
   * @param {string} searchTerms
   * @return {*}  {Promise<string>}
   * @memberof ItisService
   */
  async getItisSolrTermSearchUrl(searchTerms: string[]): Promise<string> {
    const itisUrl = this._getItisSolrUrl();

    if (!itisUrl) {
      defaultLog.debug({ label: 'getItisTermSearchUrl', message: 'Environment variable ITIS_URL is not defined.' });
      throw new Error('Failed to build ITIS query.');
    }

    return `${itisUrl}?${this._getItisSolrTypeParam()}&${this._getItisSolrSortParam(
      ['kingdom'],
      ['asc'],
      150
    )}&${this._getItisSolrFilterParam()}&${this._getItisSolrQueryParam(searchTerms)}`;
  }

  /**
   * Get the ITIS SOLR search-by-tsn URL.
   *
   * @param {number[]} searchTsnIds
   * @return {*}  {Promise<string>}
   * @memberof ItisService
   */
  async getItisSolrTsnSearchUrl(searchTsnIds: number[]): Promise<string> {
    const itisUrl = this._getItisSolrUrl();

    if (!itisUrl) {
      defaultLog.debug({ label: 'getItisTsnSearchUrl', message: 'Environment variable ITIS_URL is not defined.' });
      throw new Error('Failed to build ITIS query.');
    }

    return `${itisUrl}??${this._getItisSolrTypeParam()}&${this._getItisSolrSortParam(
      ['kingdom'],
      ['asc'],
      150
    )}&${this._getItisSolrFilterParam()}&&q=${this._getItisSolrTsnSearch(searchTsnIds)}`;
  }

  /**
   * Get the ITIS SOLR search-by-tsn URL for hierarchy information
   *
   * @param {number[]} tsnIds
   * @return {*}  {string}
   * @memberof ItisService
   */
  getItisSolrTsnHierarchyUrl(tsnIds: number[]): string {
    const itisUrl = this._getItisSolrUrl();

    if (!itisUrl) {
      defaultLog.debug({ label: 'getItisTsnHierarchyUrl', message: 'Environment variable ITIS_URL is not defined.' });
      throw new Error('Failed to build ITIS query.');
    }

    return `${itisUrl}??${this._getItisSolrTypeParam()}&${this._getItisSolrSortParam(
      ['kingdom'],
      ['asc'],
      150
    )}&${this._getItisSolrHierarchyParam()}&&q=${this._getItisSolrTsnSearch(tsnIds)}`;
  }

  /**
   * Get ITIS SOLR base URL.
   *
   * @return {*}  {(string | undefined)}
   * @memberof ItisService
   */
  _getItisSolrUrl(): string | undefined {
    return process.env.ITIS_SOLR_URL;
  }

  /**
   * Get ITIS SOLR type param.
   *
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrTypeParam(): string {
    return 'wt=json';
  }

  /**
   * Get ITIS SOLR sort param.
   *
   * @param {string} sortBy
   * @param {('asc' | 'desc')} sortDir
   * @param {number} limit
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrSortParam(sortBy: string[], sortDir: ('asc' | 'desc')[], limit: number): string {
    return `sort=${sortBy.map((f, index) => `${f}+${sortDir[index]}`).join(',')}&rows=${limit}`;
  }

  /**
   * Get ITIS SOLR filter param.
   *
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrFilterParam(): string {
    return 'omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage+rank';
  }

  /**
   * Get ITIS SOLR filter param.
   *
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrHierarchyParam(): string {
    return 'omitHeader=true&fl=tsn+hierarchyTSN';
  }

  /**
   * Get ITIS SOLR query by search term param.
   *
   * @param {string[]} searchTerms
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrQueryParam(searchTerms: string[]): string {
    const queryParams = searchTerms
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term) => {
        // Logical OR between scientific name and vernacular name
        return `((nameWOInd:*${term}*+AND+usage:/(valid|accepted)/)+OR+(vernacular:*${term}*+AND+usage:/(valid|accepted)/))`;
      })
      // Logical AND between sets of search terms
      .join('+AND+');

    return `q=${queryParams}`;
  }

  /**
   * Get ITIS SOLR query by TSN param
   *
   * @param {number[]} searchTsnIds
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrTsnSearch(searchTsnIds: number[]): string {
    return searchTsnIds.map((tsn) => `tsn:${tsn}`).join('+');
  }
}
