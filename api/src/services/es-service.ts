import { Client } from '@elastic/elasticsearch';
import { AggregationsAggregate, SearchResponse, SearchHit } from '@elastic/elasticsearch/lib/api/types';

/**
 * Base class for services that require a elastic search connection.
 *
 * @export
 * @class ESService
 */
export class ESService {
  esClient: any = undefined;

  /**
   *
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
   * Performs a search using Elasticsearch client
   * 
   * @param indexName Name of the search index
   * @param fields `fields` argument 
   * @param match Optional `match` argument
   * @param source Optional `_source` argument
   * @returns {*} {Promise<SearchHit<T>[]>}
   */
  async search<T = unknown>(indexName: string, fields: string[], match?: Record<string, string>, source?: string[]): Promise<SearchHit<T>[]> {
    const index = indexName.toLowerCase()
  
    const esClient = await this.getEsClient();

    const response: SearchResponse<T, Record<string, AggregationsAggregate>> = await esClient.search<T>({
      index,
      query: match ? { match } : undefined,
      fields,
      _source: source || false
    });

    return response.hits.hits
  }
}
