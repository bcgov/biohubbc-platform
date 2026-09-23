import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { countSubmissionUploadFeatures } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import { HTTP400 } from '../../../../../../../../errors/http-error';
import { SearchFeatureService } from '../../../../../../../../services/search-feature-service';
import { SubmissionUploadService } from '../../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

describe('countSubmissionUploadFeatures', () => {
  afterEach(() => sinon.restore());

  it('counts upload matches with both route identifiers and no ownership lookup', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const uploadLookup = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId');
    const count = sinon.stub(SearchFeatureService.prototype, 'countSubmissionUploadFeatures').resolves(3);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '16', submissionUploadId: '11111111-1111-4111-8111-111111111111' };
    mockReq.body = {};

    await countSubmissionUploadFeatures()(mockReq, mockRes, () => {});

    expect(count).to.have.been.calledOnceWithExactly(16, mockReq.params.submissionUploadId, { expression: null });
    expect(uploadLookup).not.to.have.been.called;
    expect(mockRes.jsonValue).to.eql({ total: 3 });
  });
  for (const expression of [
    null,
    { type: 'expression', operator: 'AND', clauses: [{ type: 'expression', operator: 'INVALID', clauses: [] }] }
  ]) {
    it(`rejects malformed expression ${JSON.stringify(expression)} before calling the service`, async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const operation = sinon.stub(SearchFeatureService.prototype, 'countSubmissionUploadFeatures');
      const rollback = sinon.stub(connection, 'rollback').resolves();
      const release = sinon.stub(connection, 'release').resolves();
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '16', submissionUploadId: '11111111-1111-4111-8111-111111111111' };
      mockReq.body = { expression };

      let caught: unknown;
      try {
        await countSubmissionUploadFeatures()(mockReq, mockRes, () => {});
      } catch (error) {
        caught = error;
      }

      expect(caught).to.be.instanceOf(HTTP400);
      expect(operation).not.to.have.been.called;
      expect(rollback).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  }
});
