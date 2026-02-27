import { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamAuthorizationRepository } from './team-authorization-repository';

describe('TeamAuthorizationRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findTeamMembershipByDataRequest', () => {
    it('returns a record when the user has team access to the data request', async () => {
      const mockRow = { data_request_id: 'dr-1', record_end_date: null };
      const mockResponse = { rowCount: 1, rows: [mockRow] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipByDataRequest(1, 'dr-1');

      expect(result).to.eql(mockRow);
    });

    it('returns null when the user does not have team access to the data request', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipByDataRequest(1, 'dr-1');

      expect(result).to.be.null;
    });
  });

  describe('findTeamPolicyBySubmissionFeature', () => {
    it('returns a record when the user has team policy access to the submission feature', async () => {
      const mockRow = { team_policy_id: 'tp-1', record_end_date: null };
      const mockResponse = { rowCount: 1, rows: [mockRow] } as unknown as QueryResult<any>;
      const mockConnection = getMockDBConnection({ sql: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamPolicyBySubmissionFeature(1, 100);

      expect(result).to.eql(mockRow);
    });

    it('returns null when the user does not have team policy access to the submission feature', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as QueryResult<any>;
      const mockConnection = getMockDBConnection({ sql: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamPolicyBySubmissionFeature(1, 100);

      expect(result).to.be.null;
    });
  });
});
