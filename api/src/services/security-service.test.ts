import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../errors/http-error';
import { Artifact } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { SecurityService } from './security-service';
import { UserService } from './user-service';

chai.use(sinonChai);

describe('SecurityService', () => {
  describe('getNextArtifactIds', () => {
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

  describe('applySecurityRulesToArtifacts', () => {
    it('should return artifact_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const securityService = new SecurityService(mockDBConnection);

      const applySecurityRulesToArtifactStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifacts')
        .resolves([{ artifact_persecution_id: 1 }, { artifact_persecution_id: 2 }]);

      sinon.stub(ArtifactService.prototype, 'updateArtifactSecurityReviewTimestamp').resolves();

      const response = await securityService.applySecurityRulesToArtifacts([1], [1, 2]);

      expect(applySecurityRulesToArtifactStub).to.be.calledOnce;
      expect(response).to.be.eql([{ artifact_persecution_id: 1 }, { artifact_persecution_id: 2 }]);
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
        expect((actualError as HTTPError).message).to.equal(
          'Documents that are pending review can only be downloaded by administrators.'
        );
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
        security_review_timestamp: new Date(),
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
        security_review_timestamp: new Date(),
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([1, 2, 3, 4]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([1, 2, 3]);

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
    });

    it('should succeed when user is not admin - but the document has no security rules applied', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: new Date(),
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([]);

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
    });

    it('should succeed when user is not admin - but has exceptions to all of the applied security rules', async () => {
      const mockDBConnection = getMockDBConnection({ systemUserId: () => 1000 });

      const securityService = new SecurityService(mockDBConnection);

      const isUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

      const isArtifactPendingReviewStub = sinon
        .stub(SecurityService.prototype, 'isArtifactPendingReview')
        .resolves(false);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: new Date(),
        key: 'sample-key'
      } as Artifact);

      const getDocumentRulesStub = sinon
        .stub(SecurityService.prototype, 'getArtifactPersecutionAndHarmRulesIds')
        .resolves([1, 2, 3, 4]);
      const getUserExceptionStub = sinon
        .stub(SecurityService.prototype, 'getPersecutionAndHarmExceptionsIdsByUser')
        .resolves([1, 2, 3, 4]);

      await securityService.getSecuredArtifactBasedOnRulesAndPermissions(1);

      expect(isUserAdminStub).to.be.calledOnce;
      expect(getArtifactStub).to.be.calledOnce;
      expect(isArtifactPendingReviewStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledOnce;
      expect(getUserExceptionStub).to.be.calledOnce;
      expect(getDocumentRulesStub).to.be.calledBefore(getUserExceptionStub);
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
});
