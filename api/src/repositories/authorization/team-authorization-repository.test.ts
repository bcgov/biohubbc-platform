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

  describe('findTeamMembershipBySubmissionUpload', () => {
    const submissionUploadId = '11111111-1111-1111-1111-111111111111';

    it('returns a record when the user has team access to the submission upload', async () => {
      const mockRow = { submission_upload_id: submissionUploadId, record_end_date: null };
      const mockResponse = { rowCount: 1, rows: [mockRow] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipBySubmissionUpload(1, submissionUploadId);

      expect(result).to.eql(mockRow);
    });

    it('returns null when the user does not have team access to the submission upload', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipBySubmissionUpload(1, submissionUploadId);

      expect(result).to.be.null;
    });

    it('joins through submission_upload.team_id and requires active records', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const sql = query.toSQL().sql.toLowerCase();
          expect(sql).to.include('join "team" as "team" on "team"."team_id" = "su"."team_id"');
          expect(sql).to.include('join "team_member" as "tm" on "tm"."team_id" = "su"."team_id"');
          expect(sql).to.include('"su"."record_end_date" is null');
          expect(sql).to.include('"team"."record_end_date" is null');
          expect(sql).to.include('"tm"."record_end_date" is null');
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamMembershipBySubmissionUpload(1, submissionUploadId);
    });
  });

  describe('findTeamMembershipBySubmissionId', () => {
    it('returns a record when the user has team access to the submission', async () => {
      const mockRow = { submission_id: 10, record_end_date: null };
      const mockResponse = { rowCount: 1, rows: [mockRow] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipBySubmissionId(1, 10);

      expect(result).to.eql(mockRow);
    });

    it('returns null when the user does not have team access to the submission', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.findTeamMembershipBySubmissionId(1, 10);

      expect(result).to.be.null;
    });

    it('joins through submission.team_id and requires active records', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const sql = query.toSQL().sql.toLowerCase();
          expect(sql).to.include('join "team" as "team" on "team"."team_id" = "s"."team_id"');
          expect(sql).to.include('join "team_member" as "tm" on "tm"."team_id" = "s"."team_id"');
          expect(sql).to.include('"s"."record_end_date" is null');
          expect(sql).to.include('"team"."record_end_date" is null');
          expect(sql).to.include('"tm"."record_end_date" is null');
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamMembershipBySubmissionId(1, 10);
    });

    it('looks up submission-team membership by UUID when a UUID is provided', async () => {
      const submissionUuid = '11111111-1111-1111-1111-111111111111';
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const compiled = query.toSQL();
          expect(compiled.sql.toLowerCase()).to.include('"s"."uuid" = ?');
          expect(compiled.bindings).to.include(submissionUuid);
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.findTeamMembershipBySubmissionUuid(1, submissionUuid);
    });
  });

  describe('isSubmissionFeatureAccessibleToUser', () => {
    it('returns true when an accessible matching feature row exists', async () => {
      const mockResponse = { rowCount: 1, rows: [{ '1': 1 }] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.isSubmissionFeatureAccessibleToUser(1, 100, 200);

      expect(result).to.be.true;
    });

    it('returns false when no accessible matching feature row exists', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.isSubmissionFeatureAccessibleToUser(1, 100, 200);

      expect(result).to.be.false;
    });

    it('requires terminal current authorization and evaluates current security over stored ancestry', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const compiled = query.toSQL();
          const sql = compiled.sql.toLowerCase();
          expect(sql).to.include('"sf"."submission_feature_id" = ?');
          expect(sql).to.include('"sf"."submission_id" = ?');
          expect(sql).to.include('sf.record_effective_date <= now()');
          expect(sql).to.include('with recursive successor_chain');
          expect(sql.match(/with recursive successor_chain/g) || []).to.have.lengthOf(1);
          expect(sql).to.include('terminal.terminal_submission_feature_id');
          expect(sql).to.include('successor.submission_id = chain.submission_id');
          expect(sql).to.include('submission_feature_closure');
          expect(sql).to.include('security_scope_anchor');
          expect(sql).to.include('with recursive historical_ancestry');
          expect(sql).to.include('and not (sf.record_effective_date <= now()');
          expect(sql).to.include('parent.submission_id = child.submission_id');
          expect(sql).to.include('not parent.submission_feature_id = any(child.path)');
          expect(sql).to.include('sfs.record_effective_date <= now()');
          expect(sql).to.include('(sfs.record_end_date is null or now() < sfs.record_end_date)');
          expect(sql).to.not.include('sfs.record_effective_date <= sf.record_end_date');
          expect(sql).to.not.include('sf.record_end_date <= sfs.record_end_date');
          expect(sql).to.include('team_security_scope');
          expect(sql).to.include('tm.record_end_date is null');
          expect(compiled.bindings).to.include.members([100, 200, 1]);
          expect(compiled.bindings.filter((binding: unknown) => binding === 1).length).to.be.at.least(2);
          return { rowCount: 0, rows: [] } as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      await repository.isSubmissionFeatureAccessibleToUser(1, 100, 200);
    });

    it('requires both current and historical contexts to be unsecured for anonymous users', async () => {
      const mockConnection = getMockDBConnection({
        knex: async (query: any) => {
          const compiled = query.toSQL();
          const sql = compiled.sql.toLowerCase();
          expect(sql).to.include('"sf"."submission_id" = ?');
          expect(sql).to.include('sf.record_effective_date <= now()');
          expect(sql).to.include('with recursive successor_chain');
          expect(sql).to.include('with recursive historical_ancestry');
          expect(sql).to.include('submission_feature_closure');
          expect(sql).to.not.include('security_scope_anchor');
          expect(sql).to.not.include('team_security_scope');
          expect(sql).to.not.match(/"?sf"?\."?record_end_date"? is not null/);
          expect(compiled.bindings).to.include.members([100, 200]);
          return { rowCount: 1, rows: [{ '1': 1 }] } as unknown as QueryResult<any>;
        }
      });

      const repository = new TeamAuthorizationRepository(mockConnection);
      const result = await repository.isSubmissionFeatureAccessibleToUser(null, 100, 200);

      expect(result).to.be.true;
    });
  });
});
