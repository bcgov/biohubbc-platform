import { Client } from '@elastic/elasticsearch';
import { AggregationsAggregate, SearchHit, SearchRequest, SearchResponse } from '@elastic/elasticsearch/lib/api/types';

export const ElasticSearchIndices = {
  EML: process.env.ELASTICSEARCH_EML_INDEX || 'eml',
  TAXONOMY: process.env.ELASTICSEARCH_TAXONOMY_INDEX || 'taxonomy_3.0.0'
};

export const ITIS_PARAMS = {
  SORT: 'wt=json&sort=nameWOInd+asc&rows=25',
  FILTER: 'omitHeader=true&fl=tsn+scientificName:nameWOInd+kingdom+parentTSN+commonNames:vernacular+updateDate+usage'
};

/**
 * Base class for services that require a elastic search connection.
 *
 * @export
 * @class ESService
 */
export class ESService {
  esClient: Client | undefined = undefined;

  /**
   * Returns the Elasticsearch Client instance. If `this.esClient` isn't defined,
   * a new Elasticsearch Client is instantiated.
   *
   * @return {*}  {Promise<Client>}
   * @memberof ESService
   */
  async getEsClient(): Promise<Client> {
    if (!this.esClient) {
      this.esClient = await new Client({ node: process.env.ELASTICSEARCH_URL });
    }
    return this.esClient;
  }

  /**
   * Performs a search in Elasticsearch.
   * @param searchRequest The ES search request
   * @returns {Promise<SearchHit<T>>} The results of the search
   */
  async _elasticSearch<T = unknown>(searchRequest: SearchRequest): Promise<SearchHit<T>[]> {
    const { index, ...request } = searchRequest;
    const esClient = await this.getEsClient();

    const response: SearchResponse<T, Record<string, AggregationsAggregate>> = await esClient.search<T>({
      index: String(index).toLowerCase(),
      ...request
    });

    return response.hits.hits;
  }

  /**
   * Searches for projects based on a given species or keyword query.
   * @param query The species/keywords to search for
   * @returns {Promise<SearchHit<unknown>>} The results of the search
   */
  async keywordSearchEml(query: string): Promise<SearchHit<unknown>[]> {
    return this._elasticSearch({
      index: ElasticSearchIndices.EML,

      query: {
        multi_match: {
          fields: ['*'],
          type: 'phrase_prefix',
          query
        }
      }
    });
  }

  /**
   * Searches for projects based on a datasetId.
   * @param query The species/keywords to search for
   * @returns {Promise<SearchHit<unknown>>} The results of the search
   */
  async datasetSearchEml(datasetId: string): Promise<SearchHit<unknown>[]> {
    return this._elasticSearch({
      index: ElasticSearchIndices.EML,
      query: {
        ids: {
          values: [datasetId]
        }
      },
      fields: ['*']
    });
  }

  /**
   * Returns the ITIS search URL.
   *
   * @param {string} searchParams
   * @return {*}  {Promise<string>}
   * @memberof ESService
   */
  async getItisTermSearchUrl(searchParams: string): Promise<string> {
    const itisUrl = process.env.ITIS_URL;
    if (!itisUrl) {
      throw new Error('ITIS_SEARCH_URL not defined.');
    }
    const itisSearchSpecies = this._getItisSearchSpeciesQuery(searchParams);

    return `${itisUrl}?${ITIS_PARAMS.SORT}&${itisSearchSpecies}&${ITIS_PARAMS.FILTER}`;
  }

  /**
   * Returns the ITIS search URL for TSN ids.
   *
   * @param {string[]} searchTsnIds
   * @return {*}  {Promise<string>}
   * @memberof ESService
   */
  async getItisTsnSearchUrl(searchTsnIds: string[]): Promise<string> {
    const itisUrl = process.env.ITIS_URL;
    if (!itisUrl) {
      throw new Error('ITIS_SEARCH_URL not defined.');
    }
    const itisSearchSpecies = this._getItisTsnSearch(searchTsnIds);

    return `${itisUrl}?${ITIS_PARAMS.SORT}&${ITIS_PARAMS.FILTER}&q=${itisSearchSpecies}`;
  }

  /**
   * Returns the ITIS search species Query.
   *
   * @param {string} searchSpecies
   * @return {*}  {string}
   * @memberof ESService
   */
  _getItisSearchSpeciesQuery(searchSpecies: string): string {
    return `q=(nameWOInd:*${searchSpecies}*+AND+usage:/(valid|accepted)/)+(vernacular:*${searchSpecies}*+AND+usage:/(valid|accepted)/)`;
  }

  /**
   * Returns the ITIS search TSN Query.
   *
   * @param {string[]} searchTsnIds
   * @return {*}  {string}
   * @memberof ESService
   */
  _getItisTsnSearch(searchTsnIds: string[]): string {
    return searchTsnIds.map((tsn) => `tsn:${tsn}`).join('+');
  }
}
