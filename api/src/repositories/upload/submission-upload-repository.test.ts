import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadWithTeam,
  SubmissionUpload,
  UpdateSubmissionUpload
} from '../../models/submission-upload';
import { UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { SubmissionUploadRepository } from './submission-upload-repository';

chai.use(sinonChai);

describe('SubmissionUploadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionUpload', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      try {
        await repo.getSubmissionUpload('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload not found');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: SubmissionUpload = {
        submission_upload_id: 'id-1',
        submission_id: 123,
        upload_id: 'upload-id',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.getSubmissionUpload('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getSubmissionUploadBySubmissionUuid', () => {
    it('throws ApiNotFoundError when no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      try {
        await repo.getSubmissionUploadBySubmissionUuid('submission-uuid', 'upload-id');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload not found');
      }
    });

    it('returns the submission upload when it belongs to the submission', async () => {
      const mockRow = {
        submission_upload_id: 'upload-id',
        submission_id: 123,
        upload_id: 'upload-uuid',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.getSubmissionUploadBySubmissionUuid('submission-uuid', 'upload-id');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getSubmissionUploadsBySubmissionId', () => {
    it('returns an array of records without filters', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          {
            submission_upload_id: 'id-1',
            submission_id: 123,
            upload_id: 'a-1',
            team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            status: 'uploaded',
            ticket_id: '11111111-1111-1111-1111-111111111111'
          },
          {
            submission_upload_id: 'id-2',
            submission_id: 123,
            upload_id: 'a-2',
            team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            status: 'uploaded',
            ticket_id: '22222222-2222-2222-2222-222222222222'
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.getSubmissionUploadsBySubmissionId(123);

      expect(result).to.eql([
        {
          submission_upload_id: 'id-1',
          submission_id: 123,
          upload_id: 'a-1',
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'uploaded',
          ticket_id: '11111111-1111-1111-1111-111111111111'
        },
        {
          submission_upload_id: 'id-2',
          submission_id: 123,
          upload_id: 'a-2',
          team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          status: 'uploaded',
          ticket_id: '22222222-2222-2222-2222-222222222222'
        }
      ]);
    });

    it('applies type filter and returns filtered records', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            submission_upload_id: 'id-1',
            submission_id: 123,
            upload_id: 'a-1',
            team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            status: 'uploaded',
            ticket_id: '11111111-1111-1111-1111-111111111111'
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const filters = { role: UploadArtifactRoleEnum.FEATURE };
      const result = await repo.getSubmissionUploadsBySubmissionId(123, filters);
      expect(result).to.eql([
        {
          submission_upload_id: 'id-1',
          submission_id: 123,
          upload_id: 'a-1',
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'uploaded',
          ticket_id: '11111111-1111-1111-1111-111111111111'
        }
      ]);
    });

    it('applies pagination', async () => {
      const mockRows = [
        {
          submission_upload_id: 'id-1',
          submission_id: 123,
          upload_id: 'a-1',
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'uploaded',
          ticket_id: '11111111-1111-1111-1111-111111111111'
        },
        {
          submission_upload_id: 'id-2',
          submission_id: 123,
          upload_id: 'a-2',
          team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          status: 'uploaded',
          ticket_id: '22222222-2222-2222-2222-222222222222'
        }
      ];
      const mockQueryResponse = {
        rowCount: 2,
        rows: mockRows
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const pagination = { page: 1, limit: 2 };
      const result = await repo.getSubmissionUploadsBySubmissionId(123, {}, pagination);
      expect(result).to.eql(mockRows);
    });
  });

  describe('findSubmissionUploadsByTicketId', () => {
    it('uses the latest submission upload status row for each upload', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      await repo.findSubmissionUploadsByTicketId('11111111-1111-1111-1111-111111111111');

      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).to.contain('INNER JOIN LATERAL');
      expect(sqlStub.firstCall.args[0].text).to.contain('submission_upload_status sus');
      expect(sqlStub.firstCall.args[0].text).to.contain('sus.create_date DESC');
      expect(sqlStub.firstCall.args[0].text).to.contain('sus.submission_upload_status_id DESC');
      expect(sqlStub.firstCall.args[0].text).to.contain('LIMIT 1');
      expect(sqlStub.firstCall.args[0].text).to.contain('sv.validation');
    });

    it('selects validation from the lateral validation alias', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      await repo.findSubmissionUploadsByTicketId('11111111-1111-1111-1111-111111111111');

      expect(sqlStub.firstCall.args[0].text).to.contain('sv.validation');
      expect(sqlStub.firstCall.args[0].text).not.to.contain('validation.validation');
    });

    it('returns scoped reviews as explicit keyed objects', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      await repo.findSubmissionUploadsByTicketId('11111111-1111-1111-1111-111111111111');

      expect(sqlStub.firstCall.args[0].text).not.to.contain('json_object_agg');
      expect(sqlStub.firstCall.args[0].text).to.contain('submission_upload_review validation_review');
      expect(sqlStub.firstCall.args[0].text).to.contain('submission_upload_review security_review');
      expect(sqlStub.firstCall.args[0].text).to.contain("'validation'");
      expect(sqlStub.firstCall.args[0].text).to.contain("'security'");
    });
  });

  describe('insertSubmissionUpload', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const payload: CreateSubmissionUploadWithTeam = {
        submission_id: 123,
        upload_id: 'a-1',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'uploaded',
        blueprint_id: 7,
        comment: 'Upload-specific note'
      };

      try {
        await repo.insertSubmissionUpload(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert submission_upload record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { submission_upload_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const payload: CreateSubmissionUploadWithTeam = {
        submission_id: 123,
        upload_id: 'a-1',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'uploaded',
        blueprint_id: 7
      };
      const result = await repo.insertSubmissionUpload(payload);

      expect(result).to.eql(mockRow);

      // The pinned Blueprint is persisted with the upload.
      expect(sqlStub.firstCall.args[0].text).to.contain('blueprint_id');
      expect(sqlStub.firstCall.args[0].values).to.include(7);
      expect(sqlStub.firstCall.args[0].text).to.contain('team_id');
      expect(sqlStub.firstCall.args[0].values).to.include('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(sqlStub.firstCall.args[0].text).to.contain('successor_submission_upload_id');
    });
  });

  describe('findMostRecentBlueprintIdBySubmissionId', () => {
    it('returns the most recent prior blueprint_id ordered by create_date', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ blueprint_id: 9 }] } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.findMostRecentBlueprintIdBySubmissionId(123);

      expect(result).to.equal(9);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.contain('FROM');
      expect(sqlText).to.contain('submission_upload');
      expect(sqlText).to.contain('create_date DESC');
      expect(sqlText).to.contain('LIMIT 1');
      // Soft-deleted prior uploads still pin a valid Blueprint, so record_end_date is not filtered.
      expect(sqlText).to.not.contain('record_end_date');
      expect(sqlStub.firstCall.args[0].values).to.include(123);
    });

    it('returns null when the submission has no prior upload', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.findMostRecentBlueprintIdBySubmissionId(123);

      expect(result).to.be.null;
    });
  });

  describe('updateSubmissionUpload', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      try {
        await repo.updateSubmissionUpload('id-1', { submission_id: 999 });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update submission_upload record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { submission_upload_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const payload: UpdateSubmissionUpload = { submission_id: 999 };
      const result = await repo.updateSubmissionUpload('id-1', payload);

      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteSubmissionUpload', () => {
    it('throws an error if soft delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      try {
        await repo.deleteSubmissionUpload('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to soft-delete submission_upload record');
      }
    });

    it('succeeds if soft delete affects one row', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_upload_id: 'id-1' }]
      } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.deleteSubmissionUpload('id-1');

      expect(result).to.be.undefined;
      expect(sqlStub.firstCall.args[0].text).to.contain('RETURNING submission_upload_id');
    });
  });

  describe('softDeleteSubmissionUpload', () => {
    it('succeeds if soft delete affects one row and returns the updated row id', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_upload_id: 'id-1' }]
      } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.softDeleteSubmissionUpload('id-1');

      expect(result).to.be.undefined;
      expect(sqlStub.firstCall.args[0].text).to.contain('RETURNING submission_upload_id');
    });
  });

  describe('softDeleteSubmissionUploadsBySubmissionId', () => {
    it('returns the number of soft-deleted rows and returns row ids from SQL', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ submission_upload_id: 'id-1' }, { submission_upload_id: 'id-2' }]
      } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.softDeleteSubmissionUploadsBySubmissionId(123);

      expect(result).to.equal(2);
      expect(sqlStub.firstCall.args[0].text).to.contain('RETURNING submission_upload_id');
    });
  });

  describe('lockSubmissionUploadsForSubmissionId', () => {
    it('locks active upload rows in deterministic order', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 2, rows: [] });
      const repo = new SubmissionUploadRepository(getMockDBConnection({ sql: sqlStub }));

      await repo.lockSubmissionUploadsForSubmissionId(123);

      const text = sqlStub.firstCall.args[0].text as string;
      expect(text).to.include('ORDER BY submission_upload_id');
      expect(text).to.include('FOR UPDATE');
    });
  });
});
