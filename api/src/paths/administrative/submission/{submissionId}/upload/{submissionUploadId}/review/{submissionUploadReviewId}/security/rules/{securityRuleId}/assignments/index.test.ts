import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { insertSubmissionUploadReviewSecurityRuleAssignments } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../../../../database/db';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { deleteSubmissionUploadReviewSecurityRuleAssignments } from './remove';

chai.use(sinonChai);

describe('review rule assignment mutations', () => {
  afterEach(() => sinon.restore());

  for (const operation of ['put', 'delete'] as const) {
    const method =
      operation === 'put'
        ? 'insertSubmissionUploadReviewSecurityRuleAssignments'
        : 'deleteSubmissionUploadReviewSecurityRuleAssignments';
    const handler =
      operation === 'put'
        ? insertSubmissionUploadReviewSecurityRuleAssignments
        : deleteSubmissionUploadReviewSecurityRuleAssignments;

    for (const featureIds of [[], [10, 20]]) {
      it(`${operation} forwards ${JSON.stringify(featureIds)} from the correct request location`, async () => {
        const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
        sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
        const mutate = sinon.stub(SubmissionUploadReviewSecurityService.prototype, method).resolves();
        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
        mockReq.params = {
          submissionId: '7',
          submissionUploadId: 'upload',
          submissionUploadReviewId: 'review',
          securityRuleId: '8'
        };
        mockReq.body = { submissionFeatureIds: featureIds };
        mockReq.query = { submission_feature_ids: operation === 'delete' ? featureIds : [999] } as any;

        await handler()(mockReq, mockRes, mockNext);

        expect(mutate).calledOnceWithExactly(7, 'upload', 'review', 8, featureIds, undefined);
        expect(mockRes.statusValue).equal(204);
        expect(connection.commit).calledOnce;
        expect(connection.rollback).not.called;
        expect(connection.release).calledOnce;
      });
    }

    it(`${operation} forwards validated expression scope`, async () => {
      const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const mutate = sinon.stub(SubmissionUploadReviewSecurityService.prototype, method).resolves();
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [{ type: 'predicate', feature_property_id: 1, feature_type_property_id: null, operator: 'Exists' }]
      };
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = {
        submissionId: '7',
        submissionUploadId: 'upload',
        submissionUploadReviewId: 'review',
        securityRuleId: '8'
      };
      mockReq.body = { expression };
      mockReq.query = {};
      await handler()(mockReq, mockRes, mockNext);
      expect(mutate).calledOnceWithExactly(7, 'upload', 'review', 8, [], expression);
      expect(connection.commit).calledOnce;
    });

    it(`${operation} rolls back and releases the connection on failure`, async () => {
      const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const failure = new Error('Invalid review ownership');
      sinon.stub(SubmissionUploadReviewSecurityService.prototype, method).rejects(failure);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = { submissionFeatureIds: [] };
      try {
        await handler()(mockReq, mockRes, mockNext);
        expect.fail('Expected request to fail');
      } catch (error) {
        expect(error).equal(failure);
      }
      expect(connection.commit).not.called;
      expect(connection.rollback).calledOnce;
      expect(connection.release).calledOnce;
    });
  }
});
