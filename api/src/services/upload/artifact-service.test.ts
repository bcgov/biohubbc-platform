import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import { ApiConflictError, ApiNotFoundError } from '../../errors/api-error';
import { HTTP401 } from '../../errors/http-error';
import { Artifact, ArtifactStatusEnum, CreateArtifact, UpdateArtifact } from '../../models/artifact';
import { ArtifactRepository } from '../../repositories/upload/artifact-repository';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from './artifact-service';

chai.use(sinonChai);

describe('ArtifactService', () => {
  let mockDBConnection: IDBConnection;
  let service: ArtifactService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifact', () => {
    it('should return a single artifact', async () => {
      const fakeArtifact: Artifact = {
        artifact_id: 'artifact-1',
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.PENDING,
        object_key: 'test-object-key',
        byte_size: '1234',
        checksum_sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T00:00:00Z',
        format: 'tar'
      };

      const stub = sinon.stub(ArtifactRepository.prototype, 'getArtifact').resolves(fakeArtifact);

      const result = await service.getArtifact('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
      expect(result).to.eql(fakeArtifact);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactRepository.prototype, 'getArtifact').throws(new Error('DB Error'));

      try {
        await service.getArtifact('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getArtifacts', () => {
    it('should return all artifacts', async () => {
      const fakeArtifacts: Artifact[] = [
        {
          artifact_id: 'artifact-1',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          bucket: 'test-bucket-1',
          object_key: 'test-object-key-1',
          byte_size: '1234',
          checksum_sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          uploaded_at: '2025-01-01T00:00:00Z',
          format: 'tar'
        },
        {
          artifact_id: 'artifact-2',
          artifact_status: ArtifactStatusEnum.PENDING,
          bucket: 'test-bucket-2',
          object_key: 'test-object-key-2',
          byte_size: '5678',
          checksum_sha256: '1234567890abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          uploaded_at: '2025-02-01T00:00:00Z',
          format: 'tar'
        }
      ];

      const stub = sinon.stub(ArtifactRepository.prototype, 'getArtifacts').resolves(fakeArtifacts);

      const result = await service.getArtifacts();

      expect(stub).to.have.been.calledWith();
      expect(result).to.eql(fakeArtifacts);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactRepository.prototype, 'getArtifacts').throws(new Error('DB Error'));

      try {
        await service.getArtifacts();
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getArtifactSignedUrl', () => {
    beforeEach(() => {
      process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
      process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME = 'quarantine-bucket';
    });

    it('should return a signed URL for a main-bucket artifact using the complete object key', async () => {
      const artifact: Artifact = {
        artifact_id: '11111111-1111-1111-1111-111111111111',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        bucket: 'main-bucket',
        object_key: 'tickets/ticket-1/upload/upload-1/file.txt',
        byte_size: '128',
        checksum_sha256: null,
        uploaded_at: '2026-04-29T00:00:00.000Z',
        format: 'txt'
      };

      sinon.stub(ArtifactRepository.prototype, 'getArtifact').resolves(artifact);
      const getSignedUrlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .resolves('https://example.com/download');

      const result = await service.getArtifactSignedUrl(artifact.artifact_id);

      expect(getSignedUrlStub).to.have.been.calledOnceWith(BucketType.MAIN, artifact.object_key);
      expect(result).to.equal('https://example.com/download');
    });

    it('should throw access denied when no artifact id is provided', async () => {
      const getArtifactStub = sinon.stub(ArtifactRepository.prototype, 'getArtifact');

      try {
        await service.getArtifactSignedUrl(null);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP401);
        expect((error as Error).message).to.equal('Access Denied');
        expect(getArtifactStub).not.to.have.been.called;
      }
    });

    it('should rethrow when the artifact is not found', async () => {
      sinon
        .stub(ArtifactRepository.prototype, 'getArtifact')
        .rejects(new ApiNotFoundError('Artifact not found', ['ArtifactRepository->getArtifact']));
      const getSignedUrlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl');

      try {
        await service.getArtifactSignedUrl('11111111-1111-1111-1111-111111111111');
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as Error).message).to.equal('Artifact not found');
        expect(getSignedUrlStub).not.to.have.been.called;
      }
    });

    it('should reject unsupported artifact buckets before requesting a signed URL', async () => {
      const artifact: Artifact = {
        artifact_id: '11111111-1111-1111-1111-111111111111',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        bucket: 'unsupported-bucket',
        object_key: 'tickets/ticket-1/upload/upload-1/file.txt',
        byte_size: '128',
        checksum_sha256: null,
        uploaded_at: '2026-04-29T00:00:00.000Z',
        format: 'txt'
      };

      sinon.stub(ArtifactRepository.prototype, 'getArtifact').resolves(artifact);
      const getSignedUrlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl');

      try {
        await service.getArtifactSignedUrl(artifact.artifact_id);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Unsupported artifact bucket: unsupported-bucket');
        expect(getSignedUrlStub).not.to.have.been.called;
      }
    });

    it('should not return a signed URL for a quarantine artifact', async () => {
      const artifact: Artifact = {
        artifact_id: '11111111-1111-1111-1111-111111111111',
        artifact_status: ArtifactStatusEnum.UPLOADED,
        bucket: 'quarantine-bucket',
        object_key: 'tickets/ticket-1/upload/upload-1/file.txt',
        byte_size: '128',
        checksum_sha256: null,
        uploaded_at: '2026-04-29T00:00:00.000Z',
        format: 'txt'
      };

      sinon.stub(ArtifactRepository.prototype, 'getArtifact').resolves(artifact);
      const getSignedUrlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .rejects(new Error('Presigned GET URLs are not allowed for the quarantine bucket'));

      try {
        await service.getArtifactSignedUrl(artifact.artifact_id);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(getSignedUrlStub).to.have.been.calledOnceWith(BucketType.QUARANTINE, artifact.object_key);
        expect((error as Error).message).to.equal('Presigned GET URLs are not allowed for the quarantine bucket');
      }
    });
  });

  describe('getArtifactByteSizesByObjectKeys', () => {
    it('forwards arguments to the repository and returns its map verbatim', async () => {
      const fakeMap = new Map<string, number>([
        ['a/key.txt', 100],
        ['a/key-2.txt', 200]
      ]);
      const stub = sinon.stub(ArtifactRepository.prototype, 'getArtifactByteSizesByObjectKeys').resolves(fakeMap);

      const result = await service.getArtifactByteSizesByObjectKeys('bucket-a', ['a/key.txt', 'a/key-2.txt']);

      expect(stub).to.have.been.calledOnceWith('bucket-a', ['a/key.txt', 'a/key-2.txt']);
      expect(result).to.equal(fakeMap);
    });
  });

  describe('insertArtifact', () => {
    it('should insert a new artifact and return its ID', async () => {
      const fakeInput: CreateArtifact = {
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.PENDING,
        object_key: 'test-object-key',
        byte_size: 1234,
        checksum_sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T00:00:00Z',
        format: 'csv'
      };

      const stub = sinon.stub(ArtifactRepository.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-new' });

      const result = await service.insertArtifact(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ artifact_id: 'artifact-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifact = {
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.PENDING,
        object_key: 'test-object-key',
        byte_size: 1234,
        checksum_sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T00:00:00Z',
        format: 'csv'
      };

      sinon.stub(ArtifactRepository.prototype, 'insertArtifact').throws(new Error('Insert failed'));

      try {
        await service.insertArtifact(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('insertArtifacts', () => {
    it('should insert artifact rows when no duplicate keys are present', async () => {
      const artifacts: CreateArtifact[] = [
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key.txt',
          byte_size: 1,
          checksum_sha256: 'a',
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'csv'
        },
        {
          bucket: 'bucket-b',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'b/key.txt',
          byte_size: 2,
          checksum_sha256: 'b',
          uploaded_at: '2026-01-01T00:01:00Z',
          format: 'csv'
        }
      ];
      const insertArtifactsStub = sinon.stub(ArtifactRepository.prototype, 'insertArtifacts').resolves([
        {
          artifact_id: '11111111-1111-1111-1111-111111111111',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          bucket: 'bucket-a',
          object_key: 'a/key.txt',
          byte_size: '1',
          checksum_sha256: 'a'.repeat(64),
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'csv'
        },
        {
          artifact_id: '22222222-2222-2222-2222-222222222222',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          bucket: 'bucket-b',
          object_key: 'b/key.txt',
          byte_size: '2',
          checksum_sha256: 'b'.repeat(64),
          uploaded_at: '2026-01-01T00:01:00Z',
          format: 'csv'
        }
      ]);

      const result = await service.insertArtifacts(artifacts);

      expect(insertArtifactsStub.calledOnceWithExactly(artifacts)).to.be.true;
      expect(result).to.have.length(2);
    });

    it('should throw conflict error and skip repository call when duplicate keys are present', async () => {
      const artifacts: CreateArtifact[] = [
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key.txt',
          byte_size: 1,
          checksum_sha256: 'a',
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'csv'
        },
        {
          bucket: 'bucket-a',
          artifact_status: ArtifactStatusEnum.UPLOADED,
          object_key: 'a/key.txt',
          byte_size: 2,
          checksum_sha256: 'b',
          uploaded_at: '2026-01-01T00:01:00Z',
          format: 'csv'
        }
      ];
      const insertArtifactsStub = sinon.stub(ArtifactRepository.prototype, 'insertArtifacts');

      try {
        await service.insertArtifacts(artifacts);
        expect.fail('Expected conflict error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as Error).message).to.equal('Duplicate artifact keys in bulk insert payload');
      }

      expect(insertArtifactsStub.called).to.be.false;
    });
  });

  describe('updateArtifact', () => {
    it('should update an existing artifact and return its ID', async () => {
      const fakeInput: UpdateArtifact = {
        bucket: 'updated-bucket',
        object_key: 'updated-object-key',
        byte_size: 5678,
        checksum_sha256: '1234567890abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T01:00:00Z'
      };

      const stub = sinon.stub(ArtifactRepository.prototype, 'updateArtifact').resolves({ artifact_id: 'artifact-1' });

      const result = await service.updateArtifact('artifact-1', fakeInput);

      expect(stub).to.have.been.calledWith('artifact-1', fakeInput);
      expect(result).to.eql({ artifact_id: 'artifact-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifact = {
        bucket: 'updated-bucket',
        object_key: 'updated-object-key',
        byte_size: 5678,
        checksum_sha256: '1234567890abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T01:00:00Z'
      };

      sinon.stub(ArtifactRepository.prototype, 'updateArtifact').throws(new Error('Update failed'));

      try {
        await service.updateArtifact('artifact-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('deleteArtifact', () => {
    it('should delete an artifact by ID', async () => {
      const stub = sinon.stub(ArtifactRepository.prototype, 'deleteArtifact').resolves();

      await service.deleteArtifact('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactRepository.prototype, 'deleteArtifact').throws(new Error('Delete failed'));

      try {
        await service.deleteArtifact('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });
});
