import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

// TODO
describe('BcgwLayerService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('constructs', async () => {
    //   const service = new BcgwLayerService();
  });

  describe('getEnvRegionNames', async () => {
    it('fetches and returns env region names', async () => {
      //   const service = new BcgwLayerService();
    });
  });

  describe('getNrmRegionNames', async () => {
    it('fetches and returns nrm region names', async () => {
      //   const service = new BcgwLayerService();
    });
  });
});
