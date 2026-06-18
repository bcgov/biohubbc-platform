import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { CreateUploadArchive, UpdateUploadArchive, UploadArchive } from '../../models/upload-archive';
import { UploadArchiveRepository } from './upload-archive-repository';

chai.use(sinonChai);

describe('UploadArchiveRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getUploadArchive', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      try {
        await repo.getUploadArchive('upload-archive-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Upload archive not found');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: UploadArchive = {
        upload_archive_id: 'upload-archive-id-1',
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.getUploadArchive('upload-archive-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getUploadArchives', () => {
    it('returns all records', async () => {
      const mockRows: UploadArchive[] = [
        {
          upload_archive_id: 'upload-archive-id-1',
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          archive_status: ProcessStatusStatusEnum.PENDING
        },
        {
          upload_archive_id: 'upload-archive-id-2',
          upload_id: 'upload-id-2',
          artifact_id: 'artifact-id-2',
          archive_status: ProcessStatusStatusEnum.COMPLETED
        }
      ];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.getUploadArchives();
      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no records found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.getUploadArchives();
      expect(result).to.eql([]);
    });
  });

  describe('getUploadArchivesByUploadId', () => {
    it('throws an error if query fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.getUploadArchivesByUploadId('upload-id-1');
      expect(result).to.eql([]);
    });

    it('returns matching records for a given upload ID', async () => {
      const mockRows: UploadArchive[] = [
        {
          upload_archive_id: 'upload-archive-id-1',
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          archive_status: ProcessStatusStatusEnum.PENDING
        },
        {
          upload_archive_id: 'upload-archive-id-2',
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-2',
          archive_status: ProcessStatusStatusEnum.COMPLETED
        }
      ];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.getUploadArchivesByUploadId('upload-id-1');
      expect(result).to.eql(mockRows);
    });
  });

  describe('findUploadArchiveByArtifactId', () => {
    it('returns null when no record is found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.findUploadArchiveByArtifactId('artifact-id-1');
      expect(result).to.be.null;
    });

    it('returns the record when one is found', async () => {
      const mockRecord: UploadArchive = {
        upload_archive_id: 'upload-archive-id-1',
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRecord] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.findUploadArchiveByArtifactId('artifact-id-1');
      expect(result).to.eql(mockRecord);
    });

    it('throws an error when more than one record is found', async () => {
      const mockQueryResponse = { rowCount: 2, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      try {
        await repo.findUploadArchiveByArtifactId('artifact-id-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Unexpected row count');
      }
    });
  });

  describe('insertUploadArchive', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: CreateUploadArchive = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };

      try {
        await repo.insertUploadArchive(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert upload archive record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { upload_archive_id: 'upload-archive-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: CreateUploadArchive = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };
      const result = await repo.insertUploadArchive(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateUploadArchive', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      try {
        await repo.updateUploadArchive('upload-archive-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update upload archive record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { upload_archive_id: 'upload-archive-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };
      const result = await repo.updateUploadArchive('upload-archive-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateUploadArchivesByUploadId', () => {
    it('throws an error if no records updated', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      try {
        await repo.updateUploadArchivesByUploadId('upload-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update upload archive record');
      }
    });

    it('returns the updated record IDs if successful', async () => {
      const mockRows = [{ upload_archive_id: 'upload-archive-id-1' }, { upload_archive_id: 'upload-archive-id-2' }];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const payload: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };
      const result = await repo.updateUploadArchivesByUploadId('upload-id-1', payload);
      expect(result).to.eql(mockRows);
      expect(result).to.have.length(2);
    });
  });

  describe('deleteUploadArchive', () => {
    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      try {
        await repo.deleteUploadArchive('upload-archive-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete upload archive record');
      }
    });

    it('succeeds if delete succeeds', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArchiveRepository(mockDBConnection);

      const result = await repo.deleteUploadArchive('upload-archive-id-1');

      expect(result).to.be.undefined;
    });
  });
});
