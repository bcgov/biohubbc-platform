import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
import { Policy } from '../../models/policy';
import { PolicyEffect, PolicyStatement } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
// Imported only for AC #5 boundary check - the production service must NOT touch
// access-grant primitives. These stubs assert on absence of calls.
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { PolicyExpressionService } from '../access-policy/policy-expression-service';
import { PolicyStatementService } from '../access-policy/policy-statement-service';
import { DownloadPolicyService } from './download-policy-service';

chai.use(sinonChai);

describe('DownloadPolicyService', () => {
  let mockDBConnection: ReturnType<typeof getMockDBConnection>;
  let downloadPolicyService: DownloadPolicyService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    downloadPolicyService = new DownloadPolicyService(mockDBConnection);
    // Default: every feature type used in this suite ('a', 'b') is treated as known.
    // Tests that exercise the unknown-name path replace this stub.
    sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
      { feature_type_id: 1, name: 'a' },
      { feature_type_id: 2, name: 'b' }
    ]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadPolicy', () => {
    it('creates one policy + N statements + N expression links and returns the policy id', async () => {
      const mockPolicy: Policy = {
        policy_id: 'p1',
        name: 'My download',
        description: 'My download',
        status: 'approved'
      };
      const mockStatement1: PolicyStatement = {
        policy_statement_id: 'ps-1',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*'
      };
      const mockStatement2: PolicyStatement = {
        policy_statement_id: 'ps-2',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:b:*'
      };

      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const createStatementStub = sinon.stub(PolicyStatementService.prototype, 'createPolicyStatement');
      createStatementStub.onCall(0).resolves(mockStatement1);
      createStatementStub.onCall(1).resolves(mockStatement2);
      const ensurePolicyExpressionStub = sinon
        .stub(PolicyExpressionService.prototype, 'ensurePolicyExpression')
        .resolves({
          policy_expression_id: 'pe-1',
          policy_id: 'p1',
          expression_id: 'e1',
          name: null,
          description: null
        });

      const result = await downloadPolicyService.createDownloadPolicy({
        name: 'My download',
        description: 'My download',
        featureTypes: ['a', 'b'],
        expressionId: 'e1'
      });

      expect(insertPolicyStub).to.have.been.calledOnce;
      expect(insertPolicyStub).to.have.been.calledWith({
        name: 'My download',
        description: 'My download',
        status: 'approved'
      });

      expect(createStatementStub).to.have.been.calledTwice;
      expect(createStatementStub.firstCall.args[0]).to.eql({
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*',
        policy_expression_id: 'pe-1'
      });
      expect(createStatementStub.secondCall.args[0]).to.eql({
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:b:*',
        policy_expression_id: 'pe-1'
      });

      expect(ensurePolicyExpressionStub).to.have.been.calledOnce;
      expect(ensurePolicyExpressionStub.firstCall.args).to.eql([{ policyId: 'p1', expressionId: 'e1' }]);

      expect(result).to.eql({ policy_id: 'p1' });
    });

    it('skips expression links when expressionId is null (broad path)', async () => {
      const mockPolicy: Policy = {
        policy_id: 'p1',
        name: 'My download',
        description: 'My download',
        status: 'approved'
      };
      const mockStatement1: PolicyStatement = {
        policy_statement_id: 'ps-1',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*'
      };
      const mockStatement2: PolicyStatement = {
        policy_statement_id: 'ps-2',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:b:*'
      };

      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      const createStatementStub = sinon.stub(PolicyStatementService.prototype, 'createPolicyStatement');
      createStatementStub.onCall(0).resolves(mockStatement1);
      createStatementStub.onCall(1).resolves(mockStatement2);
      const ensurePolicyExpressionStub = sinon.stub(PolicyExpressionService.prototype, 'ensurePolicyExpression');

      await downloadPolicyService.createDownloadPolicy({
        name: 'My download',
        description: 'My download',
        featureTypes: ['a', 'b'],
        expressionId: null
      });

      expect(createStatementStub).to.have.been.calledTwice;
      expect(ensurePolicyExpressionStub).to.not.have.been.called;
    });

    it('does not invoke security-scope or team-policy access-grant primitives (AC #5)', async () => {
      const mockPolicy: Policy = {
        policy_id: 'p1',
        name: 'My download',
        description: null,
        status: 'approved'
      };
      const mockStatement: PolicyStatement = {
        policy_statement_id: 'ps-1',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*'
      };

      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementService.prototype, 'createPolicyStatement').resolves(mockStatement);
      sinon.stub(PolicyExpressionService.prototype, 'ensurePolicyExpression').resolves({
        policy_expression_id: 'pe-1',
        policy_id: 'p1',
        expression_id: 'e1',
        name: null,
        description: null
      });
      // The boundary stubs: if the production service ever wires these in, these
      // assertions fail and the access-grant boundary is restored.
      const insertTeamPolicyStub = sinon.stub(TeamPolicyRepository.prototype, 'insertTeamPolicy').resolves({
        team_policy_id: 'tp1',
        team_id: 't1',
        policy_id: 'p1'
      });

      await downloadPolicyService.createDownloadPolicy({
        name: 'My download',
        description: null,
        featureTypes: ['a'],
        expressionId: 'e1'
      });

      expect(insertTeamPolicyStub).to.not.have.been.called;
    });

    it('passes description through to insertPolicy: null becomes undefined, non-null is preserved', async () => {
      const mockPolicy: Policy = {
        policy_id: 'p1',
        name: 'My download',
        description: null,
        status: 'approved'
      };
      const mockStatement: PolicyStatement = {
        policy_statement_id: 'ps-1',
        policy_id: 'p1',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*'
      };

      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementService.prototype, 'createPolicyStatement').resolves(mockStatement);

      // null -> undefined
      await downloadPolicyService.createDownloadPolicy({
        name: 'No desc',
        description: null,
        featureTypes: ['a'],
        expressionId: null
      });

      expect(insertPolicyStub.getCall(0).args[0].description).to.equal(undefined);

      // non-null -> preserved
      await downloadPolicyService.createDownloadPolicy({
        name: 'With desc',
        description: 'My download',
        featureTypes: ['a'],
        expressionId: null
      });

      expect(insertPolicyStub.getCall(1).args[0].description).to.equal('My download');
    });

    it('throws HTTP400 when any featureType is unknown (AC #7)', async () => {
      // Replace the default `getActiveFeatureTypeMap` stub: 'a' is known, 'not_a_real_type' is not.
      sinon.restore();
      sinon
        .stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap')
        .resolves([{ feature_type_id: 1, name: 'a' }]);
      const insertPolicyStub = sinon.stub(PolicyRepository.prototype, 'insertPolicy');

      try {
        await downloadPolicyService.createDownloadPolicy({
          name: 'Bad types',
          description: null,
          featureTypes: ['a', 'not_a_real_type'],
          expressionId: null
        });
        expect.fail('expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
      }

      // No policy was inserted — validation runs before any write.
      expect(insertPolicyStub).to.not.have.been.called;
    });

    it('returns the policy_id from insertPolicy', async () => {
      const mockPolicy: Policy = {
        policy_id: 'p-returned',
        name: 'r',
        description: null,
        status: 'approved'
      };
      const mockStatement: PolicyStatement = {
        policy_statement_id: 'ps-1',
        policy_id: 'p-returned',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:*:a:*'
      };

      sinon.stub(PolicyRepository.prototype, 'insertPolicy').resolves(mockPolicy);
      sinon.stub(PolicyStatementService.prototype, 'createPolicyStatement').resolves(mockStatement);

      const result = await downloadPolicyService.createDownloadPolicy({
        name: 'r',
        description: null,
        featureTypes: ['a'],
        expressionId: null
      });

      expect(result).to.eql({ policy_id: 'p-returned' });
    });
  });
});
