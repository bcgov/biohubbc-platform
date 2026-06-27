import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTPError } from '../errors/http-error';
import { Artifact } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { SecurityScopeService } from './access-policy/security-scope-service';
import { ArtifactService } from './old-artifact-service';
import { SecurityService } from './security-service';
import { UserService } from './user-service';

chai.use(sinonChai);

describe('SecurityService', () => {
  describe('getPersecutionAndHarmRules', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should retrieve an array of artifact PersecutionAndHarmSecurity Rules', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getPersecutionAndHarmRulesStub = sinon
        .stub(SecurityRepository.prototype, 'getPersecutionAndHarmRules')
        .resolves([
          {
            persecution_or_harm_id: 1,
            persecution_or_harm_type_id: 1,
            wldtaxonomic_units_id: 1,
            name: 'test',
            description: 'test'
          }
        ]);

      const result = await securityService.getPersecutionAndHarmRules();

      expect(getPersecutionAndHarmRulesStub).to.be.calledWith();
      expect(result).to.eql([
        {
          persecution_or_harm_id: 1,
          persecution_or_harm_type_id: 1,
          wldtaxonomic_units_id: 1,
          name: 'test',
          description: 'test'
        }
      ]);
    });
  });

  describe('getSecurityAppliedStatus', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns pending when no security applied', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: null,
        key: 'sample-key'
      } as Artifact);

      const result = await securityService.getSecurityAppliedStatus(1);

      expect(getArtifactStub).to.be.calledWith(1);
      expect(result).to.eql('PENDING');
    });

    it('returns unsecured when no security applied', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: '2021-01-01',
        key: 'sample-key'
      } as unknown as Artifact);

      const getPersecutionAndHarmRulesByArtifactIdStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmRulesByArtifactId')
        .resolves([]);

      const result = await securityService.getSecurityAppliedStatus(1);

      expect(getArtifactStub).to.be.calledWith(1);
      expect(getPersecutionAndHarmRulesByArtifactIdStub).to.be.calledWith(1);
      expect(result).to.eql('UNSECURED');
    });

    it('returns unsecured when no security applied', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: '2021-01-01',
        key: 'sample-key'
      } as unknown as Artifact);

      const getPersecutionAndHarmRulesByArtifactIdStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmRulesByArtifactId')
        .resolves([{ persecution_or_harm_id: 1, artifact_id: 1, artifact_persecution_id: 1 }]);

      const result = await securityService.getSecurityAppliedStatus(1);

      expect(getArtifactStub).to.be.calledWith(1);
      expect(getPersecutionAndHarmRulesByArtifactIdStub).to.be.calledWith(1);
      expect(result).to.eql('SECURED');
    });
  });

  describe('getPersecutionAndHarmRulesByArtifactId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should retrieve an array of artifact PersecutionAndHarmSecurity Rules', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getPersecutionAndHarmRulesByArtifactIdStub = sinon
        .stub(SecurityRepository.prototype, 'getPersecutionAndHarmRulesByArtifactId')
        .resolves([]);

      const result = await securityService.getPersecutionAndHarmRulesByArtifactId(1);

      expect(getPersecutionAndHarmRulesByArtifactIdStub).to.be.calledWith(1);
      expect(result).to.eql([]);
    });
  });

  describe('applySecurityRulesToArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return artifact_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const applySecurityRulesToArtifactStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifact')
        .resolves([{ artifact_persecution_id: 1 }, { artifact_persecution_id: 2 }]);

      sinon.stub(ArtifactService.prototype, 'updateArtifactSecurityReviewTimestamp').resolves();

      const response = await securityService.applySecurityRulesToArtifacts([1], [1, 2]);

      expect(applySecurityRulesToArtifactStub).to.be.calledOnce;
      expect(response).to.be.eql([[{ artifact_persecution_id: 1 }, { artifact_persecution_id: 2 }]]);
    });
  });

  describe('applySecurityRulesToArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    describe('with no existing rules', () => {
      it('handles permit deletes/updates/creates', async () => {
        const mockDBConnection = getMockDBConnection();

        const getPersecutionAndHarmRulesByArtifactIdStub = sinon
          .stub(SecurityService.prototype, 'getPersecutionAndHarmRulesByArtifactId')
          .resolves([]);

        const deleteSecurityRuleFromArtifactStub = sinon
          .stub(SecurityService.prototype, 'deleteSecurityRuleFromArtifact')
          .resolves();

        const applySecurityRulesToArtifactStub = sinon
          .stub(SecurityRepository.prototype, 'applySecurityRulesToArtifact')
          .resolves();

        const securityService = new SecurityService(mockDBConnection);

        await securityService.applySecurityRulesToArtifact(1, [1]);

        expect(getPersecutionAndHarmRulesByArtifactIdStub).to.have.been.calledOnceWith(1);

        expect(deleteSecurityRuleFromArtifactStub).not.to.have.been.called;

        expect(applySecurityRulesToArtifactStub).to.have.been.calledOnceWith(1, 1);
      });
    });

    describe('with existing permits', () => {
      it('handles permit deletes/updates/creates', async () => {
        const mockDBConnection = getMockDBConnection();

        const getPersecutionAndHarmRulesByArtifactIdStub = sinon
          .stub(SecurityService.prototype, 'getPersecutionAndHarmRulesByArtifactId')
          .resolves([{ persecution_or_harm_id: 3, artifact_id: 1, artifact_persecution_id: 1 }]);

        const deleteSecurityRuleFromArtifactStub = sinon
          .stub(SecurityRepository.prototype, 'deleteSecurityRuleFromArtifact')
          .resolves();

        const applySecurityRulesToArtifactStub = sinon
          .stub(SecurityRepository.prototype, 'applySecurityRulesToArtifact')
          .resolves();

        const securityService = new SecurityService(mockDBConnection);

        await securityService.applySecurityRulesToArtifact(1, [1, 2]);

        expect(getPersecutionAndHarmRulesByArtifactIdStub).to.have.been.calledOnceWith(1);

        expect(deleteSecurityRuleFromArtifactStub).to.have.been.calledOnceWith(1, 3);

        expect(applySecurityRulesToArtifactStub).to.have.callCount(2);
        expect(applySecurityRulesToArtifactStub.firstCall.args).to.eql([1, 1]);
        expect(applySecurityRulesToArtifactStub).to.have.been.calledWith(1, 2);
      });
    });
  });

  describe('deleteSecurityRuleFromArtifact', () => {
    it('should return artifact_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const applySecurityRulesToArtifactStub = sinon
        .stub(SecurityRepository.prototype, 'deleteSecurityRuleFromArtifact')
        .resolves();

      const response = await securityService.deleteSecurityRuleFromArtifact(1, 2);

      expect(applySecurityRulesToArtifactStub).to.be.calledOnce;
      expect(response).to.be.eql(undefined);
    });
  });

  describe('getSecuredArtifactBasedOnRulesAndPermissions', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error if user is not admin, and document is pending review (does not have a security review timestamp', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(true);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: undefined,
        key: 'sample-key'
      } as Artifact);

      try {
        await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);
        expect.fail();
      } catch (actualError) {
        expect(isUserAdminStub).to.be.calledOnce;
        expect(isArtifactPendingReviewStub).to.be.calledOnce;
        expect(getArtifactStub).to.not.be.called;
        expect((actualError as HTTPError).status).to.equal(403);
        expect((actualError as HTTPError).message).to.equal('You do not have access to this document.');
      }
    });

    it('should throw an error if user is not admin, and user does not have exceptions to all the documents security rules', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);
      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: 'date',
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([1, 2, 3, 4]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([1, 2, 3]);

      try {
        await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);
        expect.fail();
      } catch (actualError) {
        expect(isUserAdminStub).to.be.calledOnce;
        expect(getArtifactStub).not.to.be.called;
        expect(isArtifactPendingReviewStub).to.be.calledOnce;
        expect(getDocumentRulesStub).to.be.calledOnce;
        expect(getUserExceptionStub).to.be.calledOnce;
        expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
        expect((actualError as HTTPError).status).to.equal(403);
        expect((actualError as HTTPError).message).to.equal('You do not have access to this document.');
      }
    });

    it('should succeed when user is admin - even if document has security rules applied', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);
      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: 'date',
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([1, 2, 3, 4]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([1, 2, 3]);

      const getS3SignedURLStub = sinon.stub(SecurityService.dependencies, 'getS3SignedURL').resolves('signed-url');

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
      expect(getS3SignedURLStub).to.be.calledOnceWith('sample-key');
    });

    it('should succeed when user is not admin - but the document has no security rules applied', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: 'date',
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([]);

      const getS3SignedURLStub = sinon.stub(SecurityService.dependencies, 'getS3SignedURL').resolves('signed-url');

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
      expect(getS3SignedURLStub).to.be.calledOnceWith('sample-key');
    });

    it('should succeed when user is not admin - but has exceptions to all of the applied security rules', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: 'date',
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([1, 2, 3, 4]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([1, 2, 3, 4]);

      const getS3SignedURLStub = sinon.stub(SecurityService.dependencies, 'getS3SignedURL').resolves('signed-url');

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
      expect(getS3SignedURLStub).to.be.calledOnceWith('sample-key');
    });
  });

  describe('getPersecutionAndHarmExceptionsByUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a number array of persecution and harm exception ids for a given user', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getPersecutionAndHarmRulesStub = sinon
        .stub(SecurityRepository.prototype, 'getPersecutionAndHarmRulesExceptionsByUserId')
        .resolves([
          {
            persecution_or_harm_id: 1
          },
          {
            persecution_or_harm_id: 2
          },
          {
            persecution_or_harm_id: 3
          }
        ]);

      const result = await securityService.getPersecutionAndHarmExceptionsIdsByUser(1000);

      expect(getPersecutionAndHarmRulesStub).to.be.calledWith(1000);
      expect(result).to.eql([1, 2, 3]);
    });
  });

  describe('getDocumentPersecutionAndHarmRules', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a number array of persecution and harm rules for a given artifact', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getDocumentPersecutionAndHarmRulesStub = sinon
        .stub(SecurityRepository.prototype, 'getDocumentPersecutionAndHarmRules')
        .resolves([
          {
            persecution_or_harm_id: 1
          },
          {
            persecution_or_harm_id: 2
          },
          {
            persecution_or_harm_id: 3
          }
        ]);

      const result = await securityService.getArtifactPersecutionAndHarmRulesIds(1000);

      expect(getDocumentPersecutionAndHarmRulesStub).to.be.calledWith(1000);
      expect(result).to.eql([1, 2, 3]);
    });
  });

  describe('isArtifactPendingReview', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return true if the artifact is pending review (timestamp is null)', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactByIdStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        key: 'secured-string',
        security_review_timestamp: null
      } as Artifact);

      const result = await securityService.isArtifactPendingReview(1000);

      expect(getArtifactByIdStub).to.be.calledWith(1000);
      expect(result).to.eql(true);
    });

    it('should return false if the artifact is pending review (timestamp is not null)', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactByIdStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        key: 'secured-string',
        security_review_timestamp: 'date'
      } as Artifact);

      const result = await securityService.isArtifactPendingReview(1000);

      expect(getArtifactByIdStub).to.be.calledWith(1000);
      expect(result).to.eql(false);
    });
  });

  describe('isSurveyPendingReview', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return true if the any artifact in the survey is pending review', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactsBySurveyIdStub = sinon.stub(ArtifactService.prototype, 'getArtifactsBySurveyId').resolves([
        {
          artifact_id: 1,
          key: 'secured-string-a',
          security_review_timestamp: null
        } as Artifact,
        {
          artifact_id: 2,
          key: 'secured-string-b',
          security_review_timestamp: null
        } as Artifact
      ]);

      sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .onFirstCall()
        .resolves(true)
        .onSecondCall()
        .resolves(false);

      const result = await securityService.isSurveyPendingReview('surveyId');

      expect(getArtifactsBySurveyIdStub).to.be.calledWith('surveyId');
      expect(result).to.eql(true);
    });

    it('should return false if the no artifact in the survey is pending review', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const getArtifactsBySurveyIdStub = sinon.stub(ArtifactService.prototype, 'getArtifactsBySurveyId').resolves([
        {
          artifact_id: 1,
          key: 'secured-string-a',
          security_review_timestamp: null
        } as Artifact,
        {
          artifact_id: 2,
          key: 'secured-string-b',
          security_review_timestamp: null
        } as Artifact
      ]);

      sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .onFirstCall()
        .resolves(false)
        .onSecondCall()
        .resolves(false);

      const result = await securityService.isSurveyPendingReview('surveyId');

      expect(getArtifactsBySurveyIdStub).to.be.calledWith('surveyId');
      expect(result).to.eql(false);
    });
  });

  describe('patchSecurityRulesOnSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('removes rules, applies rules, and triggers scope recomputation', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon.stub(SecurityRepository.prototype, 'removeSecurityFromSubmission').resolves([
        {
          submission_feature_security_id: 1,
          submission_feature_id: 10,
          security_rule_id: 6,
          record_effective_date: '',
          record_end_date: null,
          create_date: '',
          create_user: 1,
          update_date: '',
          update_user: 1,
          revision_count: 1
        }
      ]);

      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityToSubmission').resolves([]);

      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmission(1, [4, 5], [6, 7]);

      expect(removeStub).to.be.calledWith(1, [6, 7]);
      expect(applyStub).to.be.calledWith(1, [4, 5]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });

    it('skips remove when no remove rule IDs are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon.stub(SecurityRepository.prototype, 'removeSecurityFromSubmission').resolves([]);
      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityToSubmission').resolves([]);
      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmission(1, [4, 5], []);

      expect(removeStub).to.not.be.called;
      expect(applyStub).to.be.calledWith(1, [4, 5]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });

    it('skips apply when no apply rule IDs are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon.stub(SecurityRepository.prototype, 'removeSecurityFromSubmission').resolves([
        {
          submission_feature_security_id: 1,
          submission_feature_id: 10,
          security_rule_id: 6,
          record_effective_date: '',
          record_end_date: null,
          create_date: '',
          create_user: 1,
          update_date: '',
          update_user: 1,
          revision_count: 1
        }
      ]);

      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityToSubmission').resolves([]);
      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmission(1, [], [6, 7]);

      expect(applyStub).to.not.be.called;
      expect(removeStub).to.be.calledWith(1, [6, 7]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });

    it('always triggers scope recomputation even when both arrays are empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      sinon.stub(SecurityRepository.prototype, 'removeSecurityFromSubmission').resolves([]);
      sinon.stub(SecurityRepository.prototype, 'applySecurityToSubmission').resolves([]);
      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmission(1, [], []);

      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });
  });

  describe('patchSecurityRulesOnSubmissionFeatures', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('removes rules, applies rules, and triggers scope recomputation', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon
        .stub(SecurityRepository.prototype, 'removeSecurityRulesFromSubmissionFeatures')
        .resolves([]);

      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityRulesToSubmissionFeatures').resolves([]);

      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmissionFeatures(1, [1, 2, 3], [4, 5], [6, 7]);

      expect(removeStub).to.be.calledWith([1, 2, 3], [6, 7]);
      expect(applyStub).to.be.calledWith([1, 2, 3], [4, 5]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });

    it('returns early when no submissionFeatureIds are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon
        .stub(SecurityRepository.prototype, 'removeSecurityRulesFromSubmissionFeatures')
        .resolves([]);

      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmissionFeatures(1, [], [4, 5], [6, 7]);

      expect(removeStub).to.not.be.called;
      expect(triggerAnchorsStub).to.not.be.called;
    });

    it('skips remove when no remove rule IDs are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon
        .stub(SecurityRepository.prototype, 'removeSecurityRulesFromSubmissionFeatures')
        .resolves([]);

      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityRulesToSubmissionFeatures').resolves([]);

      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmissionFeatures(1, [1, 2, 3], [4, 5], []);

      expect(removeStub).to.not.be.called;
      expect(applyStub).to.be.calledWith([1, 2, 3], [4, 5]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });

    it('skips apply when no apply rule IDs are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const removeStub = sinon
        .stub(SecurityRepository.prototype, 'removeSecurityRulesFromSubmissionFeatures')
        .resolves([]);

      const applyStub = sinon.stub(SecurityRepository.prototype, 'applySecurityRulesToSubmissionFeatures').resolves([]);

      const triggerAnchorsStub = sinon
        .stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission')
        .resolves();

      await service.patchSecurityRulesOnSubmissionFeatures(1, [1, 2, 3], [], [6, 7]);

      expect(applyStub).to.not.be.called;
      expect(removeStub).to.be.calledWith([1, 2, 3], [6, 7]);
      expect(triggerAnchorsStub).to.be.calledOnceWith(1);
    });
  });

  describe('getSecurityRulesForSubmissionFeatures', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('getSecurityRulesForSubmissionFeatures', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SecurityService(mockDBConnection);

      const applySecurity = sinon.stub(SecurityRepository.prototype, 'getSecurityRulesForSubmissionFeatures').resolves([
        {
          submission_feature_security_id: 1,
          submission_feature_id: 1,
          security_rule_id: 1,
          record_effective_date: '',
          record_end_date: null,
          create_date: '',
          create_user: 1,
          update_date: '',
          update_user: 1,
          revision_count: 1
        }
      ]);
      const response = await service.getSecurityRulesForSubmissionFeatures([1]);

      expect(applySecurity).to.be.calledOnce;
      expect(response.length).to.be.greaterThan(0);
    });
  });
});
