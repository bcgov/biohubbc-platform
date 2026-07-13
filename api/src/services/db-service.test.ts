import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DBService } from './db-service';

chai.use(sinonChai);

describe('DBService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('mapChunksSequential', () => {
    it('processes chunks sequentially and delays between chunks only', async () => {
      const delayStub = sinon.stub(DBService, 'delay').resolves();
      const callback = sinon.stub();
      callback.onFirstCall().resolves([1]);
      callback.onSecondCall().resolves([2]);
      callback.onThirdCall().resolves([3]);

      const response = await DBService.mapChunksSequential([1, 2, 3, 4, 5], 2, callback, 500);

      expect(response).to.eql([1, 2, 3]);
      expect(callback).to.have.callCount(3);
      expect(callback.firstCall.args[0]).to.eql([1, 2]);
      expect(callback.secondCall.args[0]).to.eql([3, 4]);
      expect(callback.thirdCall.args[0]).to.eql([5]);
      expect(delayStub).to.have.callCount(2);
      expect(delayStub).to.have.been.calledWith(500);
    });

    it('rejects invalid chunk sizes', async () => {
      try {
        await DBService.mapChunksSequential([1], 0, async () => []);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Chunk size must be a positive integer.');
      }
    });

    it('rejects invalid delays', async () => {
      try {
        await DBService.mapChunksSequential([1], 1, async () => [], -1);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Chunk delay must be a non-negative finite number.');
      }
    });
  });
});
