import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ESService } from './es-service';

chai.use(sinonChai);

describe('ESService', () => {
  it('constructs', () => {
    const esService = new ESService();

    expect(esService).to.be.instanceof(ESService);
  });

  it('throws an error when getting the Elastic Search client fails', async () => {
    sinon.stub(ESService.prototype, 'getEsClient').resolves(undefined);
    const esClient = await new ESService().getEsClient();

    try {
      await esClient.search();
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal("Cannot read property 'search' of undefined");
    }
  });
});
