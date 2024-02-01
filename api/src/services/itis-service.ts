import axios from 'axios';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('services/taxonomy-service');

export interface ITaxonomySource {
  unit_name1: string;
  unit_name2: string;
  unit_name3: string;
  taxon_authority: string;
  code: string;
  tty_kingdom: string;
  tty_name: string;
  english_name: string;
  note: string | null;
  end_date: string | null;
  parent_id: number | null;
  parent_hierarchy: { id: number; level: string }[];
}

export interface IItisSearchResponse {
  commonNames: string[];
  kingdom: string;
  name: string;
  parentTSN: string;
  scientificName: string;
  tsn: string;
  updateDate: string;
  usage: string;
}

export interface IItisSearchResult {
  tsn: string;
  label: string;
  scientificName: string;
}

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
   * @param {*} searchTerms
   * @return {*}  {(Promise<IItisSearchResult[]>)}
   * @memberof TaxonomyService
   */
  async searchItisByTerm(searchTerms: string[]): Promise<IItisSearchResult[]> {
    const url = await this.getItisSolrTermSearchUrl(searchTerms);

    defaultLog.debug({ label: 'searchItisByTerm', message: 'url', url });

    const response = await axios.get(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return this._sanitizeItisData(response.data.response.docs);
  }

  /**
   * Returns the ITIS search by TSN.
   *
   * @param {number[]} searchTsnIds
   * @return {*}  {(Promise<IItisSearchResponse[]>)}
   * @memberof TaxonomyService
   */
  async searchItisByTSN(searchTsnIds: number[]): Promise<IItisSearchResponse[]> {
    const url = await this.getItisSolrTsnSearchUrl(searchTsnIds);

    defaultLog.debug({ label: 'searchItisByTSN', message: 'url', url });

    const response = await axios.get(url);

    if (!response.data || !response.data.response || !response.data.response.docs) {
      return [];
    }

    return response.data.response.docs;
  }

  /**
   * Cleans up the ITIS search response data.
   *
   * @param {IItisSearchResponse[]} data
   * @memberof TaxonomyService
   */
  _sanitizeItisData = (data: IItisSearchResponse[]): IItisSearchResult[] => {
    return data.map((item: IItisSearchResponse) => {
      const commonName = (item.commonNames && item.commonNames[0].split('$')[1]) || item.scientificName;

      return {
        tsn: item.tsn,
        label: commonName,
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

    // const itisSearchSpecies = this._getItisSolrSearchSpeciesQuery(searchParams);

    return `${itisUrl}?${this._getItisSolrTypeParam()}&${this._getItisSolrSortParam(
      'nameWOInd',
      'asc',
      25
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
      'nameWOInd',
      'asc',
      25
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
   * @param {number} [limit=25]
   * @return {*}  {string}
   * @memberof ItisService
   */
  _getItisSolrSortParam(sortBy: string, sortDir: 'asc' | 'desc', limit = 25): string {
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
        return `(nameWOInd:*${term}*+AND+usage:/(valid|accepted)/)+OR+(vernacular:*${term}*+AND+usage:/(valid|accepted)/)`;
      })
      .join('+OR+');

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
