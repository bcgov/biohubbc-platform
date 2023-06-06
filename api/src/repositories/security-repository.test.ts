import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { SecurityRepository } from './security-repository';

chai.use(sinonChai);

describe.only('SecurityRepository', () => {
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

  describe('removeAllSecurityRulesFromArtifact', () => {
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

      const response = await securityRepository.removeAllSecurityRulesFromArtifact(1);

      expect(response).to.eql(undefined);
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
        await securityRepository.removeAllSecurityRulesFromArtifact(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to remove all security rules from artifact');
      }
    });
  });
});
