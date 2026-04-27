import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { Artifact, ArtifactStatusEnum, CreateArtifact } from '../../models/artifact';
import { ArtifactRepository } from './artifact-repository';

chai.use(sinonChai);

describe('ArtifactRepository', () => {
  describe('insertArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('builds a direct upsert query without DISTINCT ON dedupe CTEs', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        if (sqlStatement.text.includes('INSERT INTO artifact')) {
          expect(sqlStatement.text).to.not.include('DISTINCT ON (bucket, object_key)');
          expect(sqlStatement.text).to.not.include('WITH ORDINALITY');
          expect(sqlStatement.text).to.not.include('distinct_input');
          expect(sqlStatement.text).to.include('FROM UNNEST(');
          expect(sqlStatement.text).to.include('ON CONFLICT (bucket, object_key) DO UPDATE');
          expect(sqlStatement.text).to.include('SET');
        }

        return Promise.resolve({
          rowCount: 3,
          rows: [
            {
              artifact_id: '11111111-1111-1111-1111-111111111111',
              artifact_status: ArtifactStatusEnum.UPLOADED,
              bucket: 'bucket-a',
              object_key: 'a/key.txt',
              byte_size: '100',
              checksum_sha256: 'a'.repeat(64),
              uploaded_at: '2026-01-01T00:00:00Z',
              format: 'csv'
            },
            {
              artifact_id: '33333333-3333-3333-3333-333333333333',
              artifact_status: ArtifactStatusEnum.UPLOADED,
              bucket: 'bucket-a',
              object_key: 'a/key-2.txt',
              byte_size: '200',
              checksum_sha256: 'b'.repeat(64),
              uploaded_at: '2026-01-01T00:01:00Z',
              format: 'csv'
            },
            {
              artifact_id: '22222222-2222-2222-2222-222222222222',
              artifact_status: ArtifactStatusEnum.UPLOADED,
              bucket: 'bucket-b',
              object_key: 'b/key.txt',
              byte_size: '300',
              checksum_sha256: 'c'.repeat(64),
              uploaded_at: '2026-01-01T00:02:00Z',
              format: 'csv'
            }
          ]
        } as any);
      });

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new ArtifactRepository(mockDBConnection);

      const payload: CreateArtifact[] = [
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key.txt',
          byte_size: 100,
          checksum_sha256: 'aaa',
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'csv'
        },
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key-2.txt',
          byte_size: 200,
          checksum_sha256: 'bbb',
          uploaded_at: '2026-01-01T00:01:00Z',
          format: 'csv'
        },
        {
          bucket: 'bucket-b',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'b/key.txt',
          byte_size: 300,
          checksum_sha256: 'ccc',
          uploaded_at: '2026-01-01T00:02:00Z',
          format: 'csv'
        }
      ];

      const result = await repo.insertArtifacts(payload);
      expect(result).to.have.length(3);
    });

    it('returns rows as-is when rowCount is lower than input key count', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: () =>
          Promise.resolve({
            rowCount: 1,
            rows: [
              {
                artifact_id: '11111111-1111-1111-1111-111111111111',
                artifact_status: ArtifactStatusEnum.UPLOADED,
                bucket: 'bucket-a',
                object_key: 'a/key.txt',
                byte_size: '100',
                checksum_sha256: 'a'.repeat(64),
                uploaded_at: '2026-01-01T00:00:00Z',
                format: 'csv'
              }
            ]
          } as any)
      });
      const repo = new ArtifactRepository(mockDBConnection);

      const result = await repo.insertArtifacts([
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key.txt',
          byte_size: 100,
          checksum_sha256: 'aaa',
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'csv'
        },
        {
          bucket: 'bucket-b',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'b/key.txt',
          byte_size: 200,
          checksum_sha256: 'bbb',
          uploaded_at: '2026-01-01T00:01:00Z',
          format: 'csv'
        }
      ]);

      expect(result).to.have.length(1);
      expect(result[0]).to.include({ bucket: 'bucket-a', object_key: 'a/key.txt' });
    });
  });

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
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Artifact not found');
      }
    });

    it('returns an artifact if found', async () => {
      const mockRow: Artifact = {
        artifact_id: 'artifact-uuid-1',
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        object_key: 'key.txt',
        byte_size: '1234',
        checksum_sha256: 'checksum',
        uploaded_at: '2025-12-31T12:00:00Z',
        format: 'tar'
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
          byte_size: '123',
          checksum_sha256: 'abc',
          uploaded_at: '2025-12-31T12:00:00Z',
          format: 'tar'
        },
        {
          artifact_id: 'artifact-uuid-2',
          bucket: 'bucket2',
          artifact_status: ArtifactStatusEnum.ARCHIVED,
          object_key: 'key2.txt',
          byte_size: '456',
          checksum_sha256: 'def',
          uploaded_at: '2025-12-31T12:10:00Z',
          format: 'tar'
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

    it('returns the inserted artifact ID on new insert', async () => {
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
        uploaded_at: '2025-12-31T12:00:00Z',
        format: 'csv'
      };

      const result = await repo.insertArtifact(payload);
      expect(result).to.eql(mockRow);
    });

    it('returns the existing artifact ID on conflict', async () => {
      const existingRow = {
        artifact_id: 'existing-uuid',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        bucket: 'bucket',
        object_key: 'key.txt',
        byte_size: '100',
        checksum_sha256: 'a'.repeat(64),
        uploaded_at: '2025-12-31T12:00:00Z',
        format: 'csv'
      };
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('ON CONFLICT (bucket, object_key) DO UPDATE');
        expect(sqlStatement.text).to.not.include('ON CONFLICT (bucket, object_key) DO NOTHING');
        return Promise.resolve({ rowCount: 1, rows: [existingRow] } as any);
      });
      const mockDBConnection = getMockDBConnection({
        sql: sqlStub
      });
      const repo = new ArtifactRepository(mockDBConnection);

      const payload: CreateArtifact = {
        bucket: 'bucket',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        object_key: 'key.txt',
        byte_size: 100,
        checksum_sha256: 'abc',
        uploaded_at: '2025-12-31T12:00:00Z',
        format: 'csv'
      };

      const result = await repo.insertArtifact(payload);
      expect(result.artifact_id).to.eql(existingRow.artifact_id);
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
