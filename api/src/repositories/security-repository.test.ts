import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { SecurityRepository } from './security-repository';

chai.use(sinonChai);

describe('SecurityRepository', () => {
  describe('getPersecutionAndHarmRules', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of PersecutionAndHarmSecurity', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            persecution_or_harm_id: 1,
            persecution_or_harm_type_id: 1,
            wldtaxonomic_units_id: 1,
            name: 'test',
            description: 'test'
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.getPersecutionAndHarmRules();

      expect(response).to.eql([
        {
          persecution_or_harm_id: 1,
          persecution_or_harm_type_id: 1,
          wldtaxonomic_units_id: 1,
          name: 'test',
          description: 'test'
        }
      ]);
    });

    it('throw an error if query fails', async () => {
      const mockQueryResponse = { rows: undefined, rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      try {
        await securityRepository.getPersecutionAndHarmRules();
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get persecution and harm rules');
      }
    });
  });

  describe('getPersecutionAndHarmRulesByArtifactId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of PersecutionAndHarmSecurity', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            artifact_persecution_id: 1,
            persecution_or_harm_id: 1,
            artifact_id: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.getPersecutionAndHarmRulesByArtifactId(1);

      expect(response).to.eql([
        {
          artifact_persecution_id: 1,
          persecution_or_harm_id: 1,
          artifact_id: 1
        }
      ]);
    });
  });

  describe('applySecurityRulesToArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('Apply security rules to an artifact, returns artifact_persecution_id', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            artifact_persecution_id: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.applySecurityRulesToArtifact(1, 1);

      expect(response).to.eql({
        artifact_persecution_id: 1
      });
    });

    it('throw an error if query fails', async () => {
      const mockQueryResponse = { rows: undefined, rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      try {
        await securityRepository.applySecurityRulesToArtifact(1, 1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to apply security rules to artifact');
      }
    });
  });

  describe('deleteSecurityRuleFromArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('Remove a security rule from an artifact. Throws no error', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            artifact_persecution_id: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const securityRepository = new SecurityRepository(mockDBConnection);

      const response = await securityRepository.deleteSecurityRuleFromArtifact(1, 1);

      expect(response).to.eql(undefined);
    });
  });

  describe('getPersecutionAndHarmRulesExceptionsByUserId', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ artifact_id: 1 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SecurityRepository(mockDBConnection);

      const response = await submissionRepository.getPersecutionAndHarmRulesExceptionsByUserId(1);

      expect(response).to.eql([{ artifact_id: 1 }]);
    });

    it('should return an empty array if not exceptions exists for the user', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SecurityRepository(mockDBConnection);

      const response = await submissionRepository.getPersecutionAndHarmRulesExceptionsByUserId(1);

      expect(response).to.eql([]);
    });
  });

  describe('getDocumentPersecutionAndHarmRules', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ persecution_or_harm_id: 1 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SecurityRepository(mockDBConnection);

      const response = await submissionRepository.getDocumentPersecutionAndHarmRules(1);

      expect(response).to.eql([{ persecution_or_harm_id: 1 }]);
    });

    it('should return an empty array if the document has no rules applied', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SecurityRepository(mockDBConnection);

      const response = await submissionRepository.getDocumentPersecutionAndHarmRules(1);

      expect(response).to.eql([]);
    });
  });

  describe('getActiveSecurityRules', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            security_rule_id: 1,
            name: 'name',
            description: 'description',
            record_effective_date: 1,
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repo = new SecurityRepository(mockDBConnection);
      const response = await repo.getActiveSecurityRules();
      expect(response.length).to.greaterThan(0);
    });

    it('should succeed with no rules', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repo = new SecurityRepository(mockDBConnection);
      const response = await repo.getActiveSecurityRules();
      expect(response.length).to.be.eql(0);
    });
  });

  describe('applySecurityRulesToSubmissionFeatures', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            submission_feature_security_id: 1,
            submission_feature_id: 1,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 2,
            submission_feature_id: 2,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 3,
            submission_feature_id: 3,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 4,
            submission_feature_id: 1,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 5,
            submission_feature_id: 2,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 6,
            submission_feature_id: 3,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repo = new SecurityRepository(mockDBConnection);
      const response = await repo.applySecurityRulesToSubmissionFeatures([1, 2, 3], [1, 2]);
      expect(response.length).to.equal(6);
    });
  });

  describe('removeAllSecurityRulesFromSubmissionFeatures', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 3,
        rows: [
          {
            submission_feature_security_id: 1,
            submission_feature_id: 1,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 2,
            submission_feature_id: 1,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 3,
            submission_feature_id: 2,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const repo = new SecurityRepository(mockDBConnection);
      const response = await repo.removeAllSecurityRulesFromSubmissionFeatures([1, 2]);
      expect(response.length).to.equal(3);
    });
  });

  describe('getSecurityRulesForSubmissionFeatures', () => {
    it('should succeed with valid data', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            submission_feature_security_id: 1,
            submission_feature_id: 1,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 2,
            submission_feature_id: 1,
            security_rule_id: 2,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          },
          {
            submission_feature_security_id: 3,
            submission_feature_id: 2,
            security_rule_id: 1,
            record_effective_date: '',
            record_end_date: null,
            create_date: 1,
            create_user: 1,
            update_date: 1,
            update_user: 1,
            revision_count: 1
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const repo = new SecurityRepository(mockDBConnection);
      const response = await repo.getSecurityRulesForSubmissionFeatures([1, 2]);
      expect(response.length).to.equal(3);
    });
  });
});
