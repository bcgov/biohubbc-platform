import { expect } from 'chai';
import sinon from 'sinon';
import { getSubmissionUploadReviewSecurityAssignments, POST } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../../database/db';
import { HTTP400 } from '../../../../../../../../../../errors/http-error';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { insertSubmissionUploadReviewSecurityRuleAssignments } from '../rules/{securityRuleId}/assignments';
import { deleteSubmissionUploadReviewSecurityRuleAssignments } from '../rules/{securityRuleId}/assignments/remove';
import { deleteSubmissionUploadReviewSecurityAssignments } from './reset';

describe('review assignment search and reset bodies', () => {
  afterEach(() => sinon.restore());
  const expression = {
    type: 'expression',
    operator: 'AND',
    clauses: [{ type: 'predicate', feature_property_id: 1, feature_type_property_id: null, operator: 'Exists' }]
  };

  it('reads filters and pagination exclusively from the POST body', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const query = sinon
      .stub(SubmissionUploadReviewSecurityService.prototype, 'getSubmissionUploadReviewSecurityAssignments')
      .resolves({ rules: [], pagination: {} } as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionUploadId: 'upload', submissionUploadReviewId: 'review' };
    mockReq.body = {
      submissionFeatureIds: [12],
      expression,
      search: 'private',
      pagination: { page: 2, limit: 10, sort: 'applied', order: 'desc' }
    };
    mockReq.query = { submission_feature_ids: [999], search: 'ignored', page: 9 } as any;
    await getSubmissionUploadReviewSecurityAssignments()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(
      query,
      7,
      'upload',
      'review',
      { submissionFeatureIds: [12], expression, keyword: 'private' },
      { page: 2, limit: 10, sort: 'applied', order: 'desc' }
    );
    expect(mockRes.statusValue).equal(200);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
    expect(POST.apiDoc?.parameters?.every((parameter) => !('in' in parameter) || parameter.in === 'path')).equal(true);
  });

  for (const submissionFeatureIds of [undefined, [], [12]]) {
    it(`passes reset body scope ${JSON.stringify(submissionFeatureIds)} to the orchestrator`, async () => {
      const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const reset = sinon
        .stub(SubmissionUploadReviewSecurityService.prototype, 'deleteSubmissionUploadReviewSecurityAssignments')
        .resolves();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7', submissionUploadId: 'upload', submissionUploadReviewId: 'review' };
      mockReq.body = { submissionFeatureIds, expression };
      await deleteSubmissionUploadReviewSecurityAssignments()(mockReq, mockRes, mockNext);
      sinon.assert.calledOnceWithExactly(reset, 7, 'upload', 'review', submissionFeatureIds ?? [], expression);
      expect(mockRes.statusValue).equal(204);
    });
  }
});

describe('assignment expression validation', () => {
  afterEach(() => sinon.restore());
  for (const handler of [
    getSubmissionUploadReviewSecurityAssignments,
    insertSubmissionUploadReviewSecurityRuleAssignments,
    deleteSubmissionUploadReviewSecurityRuleAssignments,
    deleteSubmissionUploadReviewSecurityAssignments
  ]) {
    it(`${handler.name} rejects deeply nested empty expressions before accessing security data`, async () => {
      const connection = getMockDBConnection({
        sql: sinon.stub(),
        knex: sinon.stub(),
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = {
        submissionId: '7',
        submissionUploadId: 'upload',
        submissionUploadReviewId: 'review',
        securityRuleId: '8'
      };
      mockReq.body = {
        expression: {
          type: 'expression',
          operator: 'AND',
          clauses: [
            { type: 'expression', operator: 'AND', clauses: [{ type: 'expression', operator: 'AND', clauses: [] }] }
          ]
        }
      };
      try {
        await handler()(mockReq, mockRes, mockNext);
        expect.fail('Expected invalid expression to be rejected');
      } catch (error) {
        expect(error).instanceOf(HTTP400);
      }
      sinon.assert.notCalled(connection.sql as sinon.SinonStub);
      sinon.assert.notCalled(connection.knex as sinon.SinonStub);
      sinon.assert.notCalled(connection.commit as sinon.SinonStub);
      sinon.assert.calledOnce(connection.rollback as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
    });
  }
});
