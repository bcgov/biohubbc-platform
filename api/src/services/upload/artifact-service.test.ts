import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import { Artifact, ArtifactStatusEnum, CreateArtifact, UpdateArtifact } from '../../models/artifact';
import { ArtifactRepository } from '../../repositories/upload/artifact-repository';
import { getMockDBConnection } from '../../__mocks__/db';
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
        uploaded_at: '2025-01-01T00:00:00Z'
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
          uploaded_at: '2025-01-01T00:00:00Z'
        },
        {
          artifact_id: 'artifact-2',
          artifact_status: ArtifactStatusEnum.PENDING,
          bucket: 'test-bucket-2',
          object_key: 'test-object-key-2',
          byte_size: '5678',
          checksum_sha256: '1234567890abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          uploaded_at: '2025-02-01T00:00:00Z'
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

  describe('insertArtifact', () => {
    it('should insert a new artifact and return its ID', async () => {
      const fakeInput: CreateArtifact = {
        bucket: 'test-bucket',
        artifact_status: ArtifactStatusEnum.PENDING,
        object_key: 'test-object-key',
        byte_size: 1234,
        checksum_sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        uploaded_at: '2025-01-01T00:00:00Z'
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
        uploaded_at: '2025-01-01T00:00:00Z'
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
