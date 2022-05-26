import { Client } from '@elastic/elasticsearch';

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
}
