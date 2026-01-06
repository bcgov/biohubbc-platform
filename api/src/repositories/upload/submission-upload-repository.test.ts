import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateSubmissionUpload, SubmissionUpload, UpdateSubmissionUpload } from '../../models/submission-upload';
import { UploadArtifactRoleEnum } from '../../models/upload-artifact';
import { getMockDBConnection } from '../../__mocks__/db';
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
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get submission_upload record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: SubmissionUpload = {
        submission_upload_id: 'id-1',
        submission_id: 123,
        upload_id: 'upload-id'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.getSubmissionUpload('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getSubmissionUploadsBySubmissionId', () => {
    it('returns an array of records without filters', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { submission_upload_id: 'id-1', submission_id: 123, upload_id: 'a-1' },
          { submission_upload_id: 'id-2', submission_id: 123, upload_id: 'a-2' }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.getSubmissionUploadsBySubmissionId(123);

      expect(result).to.eql([
        { submission_upload_id: 'id-1', submission_id: 123, upload_id: 'a-1' },
        { submission_upload_id: 'id-2', submission_id: 123, upload_id: 'a-2' }
      ]);
    });

    it('applies type filter and returns filtered records', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_upload_id: 'id-1', submission_id: 123, upload_id: 'a-1' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const filters = { role: UploadArtifactRoleEnum.FEATURE };
      const result = await repo.getSubmissionUploadsBySubmissionId(123, filters);
      expect(result).to.eql([{ submission_upload_id: 'id-1', submission_id: 123, upload_id: 'a-1' }]);
    });

    it('applies pagination', async () => {
      const mockRows = [
        { submission_upload_id: 'id-1', submission_id: 123, upload_id: 'a-1' },
        { submission_upload_id: 'id-2', submission_id: 123, upload_id: 'a-2' }
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

  describe('insertSubmissionUpload', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const payload: CreateSubmissionUpload = { submission_id: 123, upload_id: 'a-1' };

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
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const payload: CreateSubmissionUpload = { submission_id: 123, upload_id: 'a-1' };
      const result = await repo.insertSubmissionUpload(payload);

      expect(result).to.eql(mockRow);
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
    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      try {
        await repo.deleteSubmissionUpload('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete submission_upload record');
      }
    });

    it('succeeds if delete affects one row', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new SubmissionUploadRepository(mockDBConnection);

      const result = await repo.deleteSubmissionUpload('id-1');

      expect(result).to.be.undefined;
    });
  });
});
