import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionUploadReviewSecurityService } from './submission-upload-review-security-service';

describe('SubmissionUploadReviewSecurityService', () => {
  afterEach(() => sinon.restore());

  for (const submissionFeatureIds of [[], [10]]) {
    it(`delegates feature scope for IDs ${JSON.stringify(
      submissionFeatureIds
    )} and allows completed reviews`, async () => {
      const service = new SubmissionUploadReviewSecurityService(getMockDBConnection());
      const validateRules = sinon.stub(service.securityRuleService, 'assertSecurityRulesValid').resolves();
      sinon
        .stub(service.submissionUploadReviewService, 'getSubmissionUploadReview')
        .resolves({ scope: 'security', status: 'completed' } as any);
      const domain = service.submissionFeatureSecurityService;
      const insert = sinon.stub(domain, 'insertSubmissionFeatureSecurity').resolves();
      const remove = sinon.stub(domain, 'deleteSubmissionFeatureSecurityRules').resolves();
      const reset = sinon.stub(domain, 'deleteSubmissionFeatureSecurity').resolves();
      const input = {
        submissionId: 7,
        submissionUploadId: 'upload',
        featureScope: { submissionFeatureIds, expression: undefined }
      };

      await service.insertSubmissionUploadReviewSecurityRuleAssignments(7, 'upload', 'review', 8, submissionFeatureIds);
      await service.deleteSubmissionUploadReviewSecurityRuleAssignments(7, 'upload', 'review', 8, submissionFeatureIds);
      await service.deleteSubmissionUploadReviewSecurityAssignments(7, 'upload', 'review', submissionFeatureIds);

      sinon.assert.calledOnceWithExactly(validateRules, [8]);
      sinon.assert.callOrder(validateRules, insert);
      sinon.assert.calledOnceWithExactly(insert, {
        ...input,
        securityRuleIds: [8],
        submissionUploadReviewId: 'review'
      });
      sinon.assert.calledOnceWithExactly(remove, { ...input, securityRuleIds: [8] });
      sinon.assert.calledOnceWithExactly(reset, input);
    });
  }

  for (const submissionFeatureIds of [undefined, [], [10]]) {
    it(`passes API feature scope to the table service for feature IDs ${JSON.stringify(
      submissionFeatureIds
    )}`, async () => {
      const service = new SubmissionUploadReviewSecurityService(getMockDBConnection());
      sinon.stub(service.securityRuleService, 'assertSecurityRulesValid').resolves();
      sinon
        .stub(service.submissionUploadReviewService, 'getSubmissionUploadReview')
        .resolves({ scope: 'security' } as any);
      const query = sinon
        .stub(service.submissionFeatureSecurityService, 'getSubmissionFeatureSecuritySelectedRules')
        .resolves({ rules: [], total: 0 });
      const filters = { keyword: 'sensitive', submissionFeatureIds };
      const pagination = { page: 1, limit: 10 };
      await service.getSubmissionUploadReviewSecurityAssignments(7, 'upload', 'review', filters, pagination);
      sinon.assert.calledOnceWithExactly(query, 7, 'upload', filters, pagination);
    });
  }

  it('returns an empty rule page for a feature outside the upload using the scoped query', async () => {
    const connection = getMockDBConnection({ sql: sinon.stub(), knex: sinon.stub() });
    const service = new SubmissionUploadReviewSecurityService(connection);
    sinon
      .stub(service.submissionUploadReviewService, 'getSubmissionUploadReview')
      .resolves({ scope: 'security' } as any);
    const rules = sinon
      .stub(service.submissionFeatureSecurityService, 'getSubmissionFeatureSecurityRules')
      .resolves({ rules: [], total: 0 });
    const pagination = { page: 1, limit: 10 };
    const result = await service.getSubmissionUploadReviewFeatureSecurityRules(7, 'upload', 'review', 999, pagination);
    expect(rules.calledOnceWithExactly('upload', [999], {}, pagination)).equal(true);
    expect(result.rules).deep.equal([]);
    expect(result.pagination.total).equal(0);
    expect((connection.sql as sinon.SinonStub).called).equal(false);
    expect((connection.knex as sinon.SinonStub).called).equal(false);
  });
});
