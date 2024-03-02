import axios from 'axios';
import { getLogger } from '../utils/logger';
import { TaxonSearchResult } from './taxonomy-service';

const defaultLog = getLogger('services/itis-service');

export type ItisSolrSearchResponse = {
  commonNames: string[];
  kingdom: string;
  name: string;
  parentTSN: string;
  scientificName: string;
  tsn: string;
  updateDate: string;
  usage: string;
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

    const response = await axios.get(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    const sanitizedResponse = this._sanitizeItisData(response.data.response.docs);

    const sortedResponse = this._sortExactMatches(sanitizedResponse, searchTerms);

    // Return only 25 records
    return sortedResponse.slice(0, 25);
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

    const response = await axios.get(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return response.data.response.docs;
  }

  /**
   * Sorts the ITIS response such that exact matches with search terms are first
   *
   * @param {ItisSolrSearchResponse[]} data
   * @memberof ItisService
   */
  _sortExactMatches = (data: TaxonSearchResult[], searchTerms: string[]): TaxonSearchResult[] => {
    // Lowercase for exact matches and join
    const searchTermsLower = searchTerms.map((item) => item.toLowerCase());

    // Custom sorting function
    const customSort = (a: TaxonSearchResult, b: TaxonSearchResult) => {
      const aInReference = checkForMatch(a, searchTermsLower);
      const bInReference = checkForMatch(b, searchTermsLower);

      if (aInReference && !bInReference) {
        return -1; // Place items from searchTerms before other items
      } else if (!aInReference && bInReference) {
        return 1; // Place other items after items from searchTerms
      } else {
        return 0; // Maintain the original order if both are from searchTerms or both are not
      }
    };

    // Function to check if an item is a match with search terms
    const checkForMatch = (item: TaxonSearchResult, searchTermsLower: string[]) => {
      // Lowercase commonName and split into individual words
      const commonNameWords = item.commonName ? item.commonName.toLowerCase().split(/\s+/) : [];

      // Lowercase scientificName and split into individual words
      const scientificNameWords = item.scientificName.toLowerCase().split(/\s+/);

      // Check if any word in commonName or scientificName matches any word in searchTerms
      return searchTermsLower.some(
        (searchTerm) =>
          commonNameWords.some((word) => word === searchTerm) || scientificNameWords.some((word) => word === searchTerm)
      );
    };

    // Sort the data array using the custom sorting function
    return data.sort(customSort);
  };

  /**
   * Cleans up the ITIS search response data.
   *
   * @param {ItisSolrSearchResponse[]} data
   * @memberof ItisService
   */
  _sanitizeItisData = (data: ItisSolrSearchResponse[]): TaxonSearchResult[] => {
    return data.map((item: ItisSolrSearchResponse) => {
      const commonName = item.commonNames ? item.commonNames[0].split('$')[1] : null;

      return {
        tsn: Number(item.tsn),
        commonName: commonName,
        scientificName: item.scientificName
      };
    });
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
      'credibilityRating',
      'desc',
      150
    )}&${this._getItisSolrFilterParam()}&${this._getItisSolrQueryParam(searchTerms)}&qf=nameWOInd^2`;
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
      'credibilityRating',
      'desc',
      150
    )}&${this._getItisSolrFilterParam()}&&q=${this._getItisSolrTsnSearch(searchTsnIds)}`;
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
  _getItisSolrSortParam(sortBy: string, sortDir: 'asc' | 'desc', limit: number): string {
    return `sort=${sortBy}+${sortDir}&rows=${limit}`;
  }

  /**
   * Get ITIS SOLR filter param.
   *
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrFilterParam(): string {
    return 'omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage';
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
