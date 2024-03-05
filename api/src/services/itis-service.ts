import axios from 'axios';
import { sortExactMatches } from '../utils/itis';
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
  rank: string;
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

    // Sort the results to place exact matches at the top
    const sortedResponse = sortExactMatches(sanitizedResponse, searchTerms);

    // Return only 25 records
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

    const response = await axios.get(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return response.data.response.docs;
  }

  /**
   * Sorts by exact matches within, ie. Keywords of "Black" and "Bear" would match on "Black Willow"
   *
   */

  /**
   * Cleans up the ITIS search response data.
   *
   * @param {ItisSolrSearchResponse[]} data
   * @memberof ItisService
   */
  _sanitizeItisData = (data: ItisSolrSearchResponse[]): TaxonSearchResult[] => {
    return data.map((item: ItisSolrSearchResponse) => {
      const englishNames = item.commonNames?.filter((name) => name.split('$')[2] === 'English');
      const commonNames = englishNames ? englishNames.map((name) => name.split('$')[1]) : null;

      return {
        tsn: Number(item.tsn),
        commonNames: commonNames || [],
        scientificName: item.scientificName,
        rank: item.rank,
        kingdom: item.kingdom
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
      100
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
    return 'omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage+rank:rankId';
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
