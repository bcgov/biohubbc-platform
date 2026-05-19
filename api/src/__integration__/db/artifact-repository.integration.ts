// Integration test for ArtifactRepository.insertArtifact — verifies the
// non-conflict (fresh insert) and conflict (duplicate bucket+object_key) paths
// work correctly against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ArtifactStatusEnum, CreateArtifact } from '../../models/artifact';
import { ArtifactRepository } from '../../repositories/upload/artifact-repository';

describe('ArtifactRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: ArtifactRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new ArtifactRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  describe('insertArtifact', () => {
    const basePayload: CreateArtifact = {
      bucket: 'test-bucket',
      object_key: 'integration-test/artifact-1.txt',
      byte_size: 1024,
      artifact_status: ArtifactStatusEnum.UPLOADED,
      checksum_sha256: 'a'.repeat(64),
      uploaded_at: '2026-01-01T00:00:00Z',
      format: 'tar'
    };

    it('returns a new artifact_id on fresh insert', async () => {
      const result = await repo.insertArtifact(basePayload);

      expect(result).to.have.property('artifact_id');
      expect(result.artifact_id).to.be.a('string').and.to.have.length(36);
    });

    it('returns the existing artifact_id on conflict (same bucket + object_key)', async () => {
      // First insert — creates the row
      const first = await repo.insertArtifact(basePayload);

      // Second insert — same bucket + object_key, hits ON CONFLICT DO NOTHING
      const second = await repo.insertArtifact({
        ...basePayload,
        byte_size: 9999,
        checksum_sha256: 'b'.repeat(64)
      });

      expect(second.artifact_id).to.equal(first.artifact_id);
    });

    it('inserts two distinct artifacts when object_key differs', async () => {
      const first = await repo.insertArtifact(basePayload);
      const second = await repo.insertArtifact({
        ...basePayload,
        object_key: 'integration-test/artifact-2.txt'
      });

      expect(first.artifact_id).to.not.equal(second.artifact_id);
    });
  });

  describe('getArtifact', () => {
    it('returns artifact with format field populated', async () => {
      const payload: CreateArtifact = {
        bucket: 'test-bucket',
        object_key: 'integration-test/get-artifact-format.txt',
        byte_size: 512,
        artifact_status: ArtifactStatusEnum.UPLOADED,
        checksum_sha256: 'c'.repeat(64),
        uploaded_at: '2026-01-01T00:00:00Z',
        format: 'csv'
      };

      const { artifact_id } = await repo.insertArtifact(payload);
      const artifact = await repo.getArtifact(artifact_id);

      expect(artifact.format).to.equal('csv');
      expect(artifact.artifact_id).to.equal(artifact_id);
      expect(artifact.artifact_status).to.equal(ArtifactStatusEnum.UPLOADED);
      expect(artifact.bucket).to.equal('test-bucket');
      expect(artifact.object_key).to.equal('integration-test/get-artifact-format.txt');
    });
  });
});
