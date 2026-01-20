import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  CreateUploadArtifact,
  UpdateUploadArtifact,
  UploadArtifact,
  UploadArtifactRoleEnum
} from '../../models/upload-artifact';
import { getMockDBConnection } from '../../__mocks__/db';
import { UploadArtifactRepository } from './upload-artifact-repository';

chai.use(sinonChai);

describe('UploadArtifactRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getUploadArtifact', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      try {
        await repo.getUploadArtifact('upload-artifact-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get upload artifact record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: UploadArtifact = {
        upload_artifact_id: 'upload-artifact-id-1',
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getUploadArtifact('upload-artifact-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getUploadArtifacts', () => {
    it('returns all records', async () => {
      const mockRows: UploadArtifact[] = [
        {
          upload_artifact_id: 'upload-artifact-id-1',
          upload_id: 'upload-id-1',
          artifact_id: 'artifact-id-1',
          role: UploadArtifactRoleEnum.FEATURE,
          upload_archive_id: null
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.getUploadArtifacts();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertUploadArtifact', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null
      };

      try {
        await repo.insertUploadArtifact(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert upload artifact record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { upload_artifact_id: 'upload-artifact-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: CreateUploadArtifact = {
        upload_id: 'upload-id-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null
      };
      const result = await repo.insertUploadArtifact(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateUploadArtifact', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: UpdateUploadArtifact = {
        upload_id: 'upload-id-2',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_artifact_id: 'upload-artifact-id-1',
        upload_archive_id: null
      };

      try {
        await repo.updateUploadArtifact('upload-artifact-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update upload artifact record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { upload_artifact_id: 'upload-artifact-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const payload: UpdateUploadArtifact = {
        upload_id: 'upload-id-2',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_artifact_id: 'upload-artifact-id-1',
        upload_archive_id: null
      };
      const result = await repo.updateUploadArtifact('upload-artifact-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteUploadArtifact', () => {
    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      try {
        await repo.deleteUploadArtifact('upload-artifact-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete upload artifact record');
      }
    });

    it('succeeds if delete succeeds', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new UploadArtifactRepository(mockDBConnection);

      const result = await repo.deleteUploadArtifact('upload-artifact-id-1');

      expect(result).to.be.undefined;
    });
  });
});
