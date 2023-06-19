import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SecurityRepository } from '../repositories/security-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { SecurityService } from './security-service';

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
});
