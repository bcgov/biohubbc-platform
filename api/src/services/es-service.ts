import { Client } from '@elastic/elasticsearch';
import { AggregationsAggregate, SearchHit, SearchRequest, SearchResponse } from '@elastic/elasticsearch/lib/api/types';

enum ElasticSearchIndices {
  EML = 'eml'
}

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
      this.esClient = await new Client({ node: process.env.BACKBONE_ELASTICSEARCH_URL });
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
}
