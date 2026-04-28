import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { DownloadExpressionRepository } from '../../repositories/download-expression-repository';
import { DownloadExpressionService } from './download-expression-service';

describe('DownloadExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('replaceDownloadExpression', () => {
    it('ends active links and inserts the replacement link when the expression changes', async () => {
      const service = new DownloadExpressionService(getMockDBConnection());

      sinon.stub(DownloadExpressionRepository.prototype, 'getDownloadExpressionsByDownloadId').resolves([
        {
          download_expression_id: 'de-1',
          download_id: 'download-1',
          expression_id: 'expr-old'
        }
      ] as any);
      const endStub = sinon
        .stub(DownloadExpressionRepository.prototype, 'deleteDownloadExpressionsByDownloadId')
        .resolves([] as any);
      const insertStub = sinon.stub(DownloadExpressionRepository.prototype, 'insertDownloadExpression').resolves({
        download_expression_id: 'de-2',
        download_id: 'download-1',
        expression_id: 'expr-new'
      } as any);

      await service.replaceDownloadExpression('download-1', 'expr-new');

      expect(endStub.calledOnceWithExactly('download-1')).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          download_id: 'download-1',
          expression_id: 'expr-new'
        })
      ).to.equal(true);
    });
  });
});
