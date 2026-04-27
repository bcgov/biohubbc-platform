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

    it('applies active team and team_member guards in the query', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const sql = query.toSQL().sql.toLowerCase();
          expect(sql).to.include('join "team" as "team" on "team"."team_id" = "dr"."team_id"');
          expect(sql).to.include('"team"."record_end_date" is null');
          expect(sql).to.include('"tm"."record_end_date" is null');
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamMembershipByDataRequest(1, 'dr-1');
    });
  });

  describe('findTeamMembershipByTicket', () => {
    it('returns a record when the user has team access to the ticket', async () => {
      const mockRow = { ticket_id: '11111111-1111-1111-1111-111111111111', record_end_date: null };
      const mockResponse = { rowCount: 1, rows: [mockRow] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipByTicket(1, mockRow.ticket_id);

      expect(result).to.eql(mockRow);
    });

    it('returns null when the user does not have team access to the ticket', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipByTicket(1, '11111111-1111-1111-1111-111111111111');

      expect(result).to.be.null;
    });

    it('applies active team and team_member guards in the query', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const sql = query.toSQL().sql.toLowerCase();
          expect(sql).to.include('join "team" as "team" on "team"."team_id" = "t"."team_id"');
          expect(sql).to.include('"team"."record_end_date" is null');
          expect(sql).to.include('"tm"."record_end_date" is null');
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamMembershipByTicket(1, '11111111-1111-1111-1111-111111111111');
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

    it('requires approved policy and active team/team_member in SQL', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<any>);
      const mockConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamPolicyBySubmissionFeature(1, 100);

      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      expect(sqlText).to.include("and p.status = 'approved'");
      expect(sqlText).to.include('inner join team t');
      expect(sqlText).to.include('and t.record_end_date is null');
      expect(sqlText).to.include('and tm.record_end_date is null');
    });
  });
});
