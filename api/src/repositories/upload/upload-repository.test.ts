import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreateUpload, UpdateUpload, Upload, UploadStatusEnum } from '../../models/upload';
import { getMockDBConnection } from '../../__mocks__/db';
import { UploadRepository } from './upload-repository';

chai.use(sinonChai);

describe('UploadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getUpload', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      try {
        await repo.getUpload('upload-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Upload not found');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: Upload = {
        upload_id: 'upload-id-1',
        upload_status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date('2025-01-01T00:00:00Z').toISOString(),
        create_user: 1,
        s3_upload_id: 's3-upload-id'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const result = await repo.getUpload('upload-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getUploads', () => {
    it('returns all records', async () => {
      const mockRows: Upload[] = [
        {
          upload_id: 'upload-id-1',
          upload_status: UploadStatusEnum.COMPLETED,
          record_end_date: new Date('2025-01-01T00:00:00Z').toISOString(),
          create_user: 1,
          s3_upload_id: 's3-upload-id'
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const result = await repo.getUploads();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertUpload', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const payload: CreateUpload = {
        upload_status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date('2025-01-01T00:00:00Z').toISOString(),
        s3_upload_id: 's3-upload-id'
      };

      try {
        await repo.insertUpload(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert upload record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { upload_id: 'upload-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const payload: CreateUpload = {
        upload_status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date('2025-01-01T00:00:00Z').toISOString(),
        s3_upload_id: 's3-upload-id'
      };
      const result = await repo.insertUpload(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateUpload', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const payload: UpdateUpload = { upload_status: UploadStatusEnum.COMPLETED };

      try {
        await repo.updateUpload('upload-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update upload record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { upload_id: 'upload-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const payload: UpdateUpload = { upload_status: UploadStatusEnum.COMPLETED };
      const result = await repo.updateUpload('upload-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteUpload', () => {
    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      try {
        await repo.deleteUpload('upload-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete upload record');
      }
    });

    it('succeeds if delete succeeds', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadRepository(mockDBConnection);

      const result = await repo.deleteUpload('upload-id-1');

      expect(result).to.be.undefined;
    });
  });
});
