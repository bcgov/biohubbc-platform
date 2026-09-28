import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { Artifact } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { ArtifactService } from './old-artifact-service';
import { SecurityService } from './security-service';

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
});
