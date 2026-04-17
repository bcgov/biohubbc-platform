import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadFragmentService } from './download-fragment-service';

describe('DownloadFragmentService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFragmentsByDownloadId', () => {
    it('delegates to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DownloadFragmentService(mockDBConnection);

      const stub = sinon.stub(DownloadFragmentRepository.prototype, 'getFragmentsByDownloadId').resolves([]);

      const result = await service.getFragmentsByDownloadId('aaaa0000-0000-0000-0000-000000000001');

      expect(stub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001');
      expect(result).to.deep.equal([]);
    });
  });
});
