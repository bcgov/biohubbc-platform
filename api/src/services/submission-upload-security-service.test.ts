import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../models/submission-upload-review';
import { SubmissionFeatureSecurityRepository } from '../repositories/submission-feature-security-repository';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadSecurityService } from './submission-upload-security-service';
import { SubmissionUploadReviewService } from './upload/submission-upload-review-service';

chai.use(sinonChai);

/**
 * Build a stored (public) expression tree with one string equality predicate.
 *
 * @param {string} value Value the predicate compares against.
 * @returns {ExpressionTree} Expression tree as read from storage.
 */
function storedExpression(value: string): ExpressionTree {
  return {
    type: 'expression',
    operator: 'AND',
    clauses: [
      { type: 'predicate', feature_property_id: 5, blueprint_feature_type_property_id: null, operator: 'Equals', value }
    ]
  };
}

/**
 * Build a normalized expression of string equality predicates on one property.
 *
 * @param {'AND' | 'OR'} operator Logical operator joining the predicates.
 * @param {string[]} values One predicate per value.
 * @returns {NormalizedExpressionTree} Normalized expression tree.
 */
function normalizedExpression(operator: 'AND' | 'OR', values: string[]): NormalizedExpressionTree {
  return {
    type: 'expression',
    operator,
    clauses: values.map((value) => ({
      type: 'predicate',
      feature_property_id: 5,
      blueprint_feature_type_property_id: null,
      operator: 'Equals',
      value,
      feature_property_type_id: 1,
      feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
      internal_predicate: { type: 'string', operator: 'Equals', value }
    }))
  };
}

describe('SubmissionUploadSecurityService', () => {
  let insertReview: sinon.SinonStub;
  let completeReview: sinon.SinonStub;
  beforeEach(() => {
    insertReview = sinon
      .stub(SubmissionUploadReviewService.prototype, 'insertSubmissionUploadReview')
      .resolves({ submission_upload_review_id: 'review-1' } as any);
    completeReview = sinon.stub(SubmissionUploadReviewService.prototype, 'updateSubmissionUploadReview').resolves();
  });
  afterEach(() => {
    sinon.restore();
  });

  describe('screenSubmissionUpload', () => {
    it('assigns each rule with an active expression to its matches and records the run summary', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);
      const insertEvent = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const completeEvent = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateSubmissionUploadSecurityStatus')
        .resolves();
      const getRules = sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([
        { security_rule_id: 1, name: 'Single expression', expression_ids: ['expression-1'] },
        { security_rule_id: 2, name: 'No expression', expression_ids: [] },
        { security_rule_id: 3, name: 'Two expressions', expression_ids: ['expression-2', 'expression-3'] }
      ]);
      const readTree = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      readTree.withArgs('expression-1').resolves(storedExpression('a'));
      readTree.withArgs('expression-2').resolves(storedExpression('b'));
      readTree.withArgs('expression-3').resolves(storedExpression('c'));
      const normalize = sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize');
      normalize.onFirstCall().resolves(normalizedExpression('AND', ['a']));
      normalize.onSecondCall().resolves(normalizedExpression('OR', ['b', 'c']));
      const insertAssignments = sinon
        .stub(SubmissionFeatureSecurityRepository.prototype, 'insertScreenedSubmissionFeatureSecurity')
        .resolves({ matched_feature_count: 3, inserted_count: 2 });

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertReview).to.have.been.calledOnceWith(1, {
        submission_upload_id: 'upload-uuid-1',
        name: 'Automatic security screening',
        description: null,
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.PENDING,
        requested_by: conn.systemUserId()
      });
      expect(insertEvent).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1', 'review-1');
      expect(normalize.firstCall.args[0]).to.eql(storedExpression('a'));
      expect(normalize.secondCall.args[0]).to.eql({
        type: 'expression',
        operator: 'OR',
        clauses: [storedExpression('b'), storedExpression('c')]
      });
      expect(insertAssignments).to.have.been.calledOnceWith({
        submissionId: 1,
        submissionUploadId: 'upload-uuid-1',
        rules: [
          { securityRuleId: 1, expression: optimizeExpression(normalizedExpression('AND', ['a'])) },
          { securityRuleId: 3, expression: optimizeExpression(normalizedExpression('OR', ['b', 'c'])) }
        ],
        submissionUploadSecurityId: 99
      });
      expect(completeReview).to.have.been.calledOnceWith(1, 'upload-uuid-1', 'review-1', {
        status: SubmissionUploadReviewStatus.COMPLETED
      });
      expect(completeEvent).to.have.been.calledOnceWith(99, 'completed', {
        evaluatedRuleCount: 2,
        skippedRuleCount: 1,
        matchedFeatureCount: 3,
        insertedAssignmentCount: 2
      });
      sinon.assert.callOrder(insertReview, insertEvent, getRules, insertAssignments, completeReview, completeEvent);
    });

    it('records every rule as skipped when none has an active expression', async () => {
      const service = new SubmissionUploadSecurityService(getMockDBConnection());
      sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const completeEvent = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateSubmissionUploadSecurityStatus')
        .resolves();
      sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([
        { security_rule_id: 1, name: 'First', expression_ids: [] },
        { security_rule_id: 2, name: 'Second', expression_ids: [] }
      ]);
      const readTree = sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree');
      const insertAssignments = sinon
        .stub(SubmissionFeatureSecurityRepository.prototype, 'insertScreenedSubmissionFeatureSecurity')
        .resolves({ matched_feature_count: 0, inserted_count: 0 });

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(readTree).not.to.have.been.called;
      expect(insertAssignments).to.have.been.calledOnceWith({
        submissionId: 1,
        submissionUploadId: 'upload-uuid-1',
        rules: [],
        submissionUploadSecurityId: 99
      });
      expect(completeEvent).to.have.been.calledOnceWith(99, 'completed', {
        evaluatedRuleCount: 0,
        skippedRuleCount: 2,
        matchedFeatureCount: 0,
        insertedAssignmentCount: 0
      });
    });

    it('fails without assigning or completing when a rule expression cannot be evaluated', async () => {
      const service = new SubmissionUploadSecurityService(getMockDBConnection());
      sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const completeEvent = sinon.stub(
        SubmissionUploadSecurityRepository.prototype,
        'updateSubmissionUploadSecurityStatus'
      );
      sinon
        .stub(SecurityRuleService.prototype, 'getScreenableSecurityRules')
        .resolves([{ security_rule_id: 1, name: 'Stale expression', expression_ids: ['expression-1'] }]);
      sinon.stub(ExpressionTreeService.prototype, 'readExpressionTree').resolves(storedExpression('a'));
      const failure = new Error('Feature property not found');
      sinon.stub(ExpressionTreeNormalizationService.prototype, 'normalize').rejects(failure);
      const insertAssignments = sinon.stub(
        SubmissionFeatureSecurityRepository.prototype,
        'insertScreenedSubmissionFeatureSecurity'
      );

      let caught: unknown;
      try {
        await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');
      } catch (error_) {
        caught = error_;
      }

      expect(caught).to.equal(failure);
      expect(insertAssignments).not.to.have.been.called;
      expect(completeReview).not.to.have.been.called;
      expect(completeEvent).not.to.have.been.called;
    });

    it('propagates completion failures to the transactional job handler', async () => {
      const service = new SubmissionUploadSecurityService(getMockDBConnection());
      sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const completeEvent = sinon.stub(
        SubmissionUploadSecurityRepository.prototype,
        'updateSubmissionUploadSecurityStatus'
      );
      sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([]);
      sinon
        .stub(SubmissionFeatureSecurityRepository.prototype, 'insertScreenedSubmissionFeatureSecurity')
        .resolves({ matched_feature_count: 0, inserted_count: 0 });
      const failure = new Error('Review completion failed');
      completeReview.rejects(failure);
      let caught: unknown;
      try {
        await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');
      } catch (error_) {
        caught = error_;
      }
      expect(caught).to.equal(failure);
      expect(completeEvent).not.to.have.been.called;
    });
  });

  describe('recordSubmissionUploadSecurityFailure', () => {
    it('inserts a scan event and marks it failed', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const insertSubmissionUploadSecurityStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 77 });
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateSubmissionUploadSecurityStatus')
        .resolves();

      await service.recordSubmissionUploadSecurityFailure('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertSubmissionUploadSecurityStub).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1', 'review-1');
      expect(insertReview.firstCall.args[1].status).to.equal(SubmissionUploadReviewStatus.BLOCKED);
      expect(completeReview).not.to.have.been.called;
      expect(updateScanEventStub).to.have.been.calledOnceWith(77, 'failed');
    });
  });
});
