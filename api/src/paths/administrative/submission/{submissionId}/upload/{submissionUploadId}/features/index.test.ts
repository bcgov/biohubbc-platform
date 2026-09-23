import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { HTTP400 } from '../../../../../../../errors/http-error';
import { SearchFeatureService } from '../../../../../../../services/search-feature-service';
import { SubmissionService } from '../../../../../../../services/submission-service';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

describe('getSubmissionUploadFeatures', () => {
  afterEach(() => sinon.restore());

  it('returns paginated features for the requested submission upload', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'release').resolves();

    const features = [
      { submission_id: 16, submission_feature_id: 2, feature_type_name: 'animal', feature_type_id: 3, secured: false }
    ];
    const getFeatures = sinon.stub(SubmissionService.prototype, 'getSubmissionUploadFeatures').resolves(features);
    sinon.stub(SubmissionService.prototype, 'getSubmissionUploadFeaturesCount').resolves(1);

    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111'
    };

    await index.getSubmissionUploadFeatures()(mockReq, mockRes, () => {});

    expect(getFeatures).to.have.been.calledWith(mockReq.params.submissionUploadId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.features).to.eql(features);
    expect(mockRes.jsonValue.pagination.total).to.equal(1);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});

describe('searchSubmissionUploadFeatures', () => {
  afterEach(() => sinon.restore());

  it('passes upload scope to admin search and returns only features and pagination', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const uploadLookup = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId');
    const result = {
      features: [],
      pagination: {
        limit: 10,
        sort: 'submission_feature_id' as const,
        order: 'asc' as const,
        next_cursor: null,
        previous_cursor: null
      }
    };
    const search = sinon.stub(SearchFeatureService.prototype, 'searchSubmissionUploadFeatures').resolves(result);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '16', submissionUploadId: '11111111-1111-4111-8111-111111111111' };
    mockReq.body = { pagination: { limit: 10, sort: 'submission_feature_id', order: 'asc' } };

    await index.searchSubmissionUploadFeatures()(mockReq, mockRes, () => {});

    expect(search).to.have.been.calledOnce;
    expect(search.firstCall.args).to.eql([
      16,
      mockReq.params.submissionUploadId,
      { expression: null },
      { limit: 10, sort: 'submission_feature_id', order: 'asc', boundary: undefined }
    ]);
    expect(uploadLookup).not.to.have.been.called;
    expect(mockRes.jsonValue).to.equal(result);
  });
  for (const expression of [
    null,
    { type: 'expression', operator: 'AND', clauses: [{ type: 'expression', operator: 'INVALID', clauses: [] }] }
  ]) {
    it(`rejects malformed expression ${JSON.stringify(expression)} before calling the service`, async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const operation = sinon.stub(SearchFeatureService.prototype, 'searchSubmissionUploadFeatures');
      const rollback = sinon.stub(connection, 'rollback').resolves();
      const release = sinon.stub(connection, 'release').resolves();
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '16', submissionUploadId: '11111111-1111-4111-8111-111111111111' };
      mockReq.body = { expression };

      let caught: unknown;
      try {
        await index.searchSubmissionUploadFeatures()(mockReq, mockRes, () => {});
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
