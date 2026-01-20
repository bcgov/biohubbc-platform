import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { Artifact, ArtifactStatusEnum, CreateArtifact } from '../../models/artifact';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactRepository } from './artifact-repository';

chai.use(sinonChai);

describe('ArtifactRepository', () => {
  describe('getArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if no artifact found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      try {
        await repo.getArtifact('artifact-id');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get artifact record');
      }
    });

    it('returns an artifact if found', async () => {
      const mockRow: Artifact = {
        artifact_id: 'artifact-uuid-1',
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        object_key: 'key.txt',
        byte_size: 1234,
        checksum_sha256: 'checksum',
        uploaded_at: '2025-12-31T12:00:00Z'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const result = await repo.getArtifact('artifact-uuid-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of artifacts', async () => {
      const mockRows: Artifact[] = [
        {
          artifact_id: 'artifact-uuid-1',
          bucket: 'bucket1',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'key1.txt',
          byte_size: 123,
          checksum_sha256: 'abc',
          uploaded_at: '2025-12-31T12:00:00Z'
        },
        {
          artifact_id: 'artifact-uuid-2',
          bucket: 'bucket2',
          artifact_status: ArtifactStatusEnum.ARCHIVED,
          object_key: 'key2.txt',
          byte_size: 456,
          checksum_sha256: 'def',
          uploaded_at: '2025-12-31T12:10:00Z'
        }
      ];

      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const result = await repo.getArtifacts();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const payload: CreateArtifact = {
        bucket: 'bucket',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        object_key: 'key.txt',
        byte_size: 100,
        checksum_sha256: 'abc',
        uploaded_at: '2025-12-31T12:00:00Z'
      };

      try {
        await repo.insertArtifact(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert artifact record');
      }
    });

    it('returns the inserted artifact ID if successful', async () => {
      const mockRow = { artifact_id: 'artifact-uuid-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const payload: CreateArtifact = {
        bucket: 'bucket',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        object_key: 'key.txt',
        byte_size: 100,
        checksum_sha256: 'abc',
        uploaded_at: '2025-12-31T12:00:00Z'
      };

      const result = await repo.insertArtifact(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      try {
        await repo.updateArtifact('artifact-uuid-1', { bucket: 'new-bucket' });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update artifact record');
      }
    });

    it('returns the updated artifact ID if successful', async () => {
      const mockRow = { artifact_id: 'artifact-uuid-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const result = await repo.updateArtifact('artifact-uuid-1', { bucket: 'new-bucket' });
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if delete fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      try {
        await repo.deleteArtifact('artifact-uuid-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete artifact record');
      }
    });

    it('succeeds if delete affects one row', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactRepository(mockDBConnection);

      const result = await repo.deleteArtifact('artifact-uuid-1');

      expect(result).to.be.undefined;
    });
  });
});
