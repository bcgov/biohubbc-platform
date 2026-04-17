import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import {
  CreateUploadArtifact,
  UpdateUploadArtifact,
  UploadArtifact,
  UploadArtifactRoleEnum
} from '../../models/upload-artifact';
import { UploadArtifactRepository } from '../../repositories/upload/upload-artifact-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { UploadArtifactService } from './upload-artifact-service';

chai.use(sinonChai);

describe('UploadArtifactService', () => {
  let mockDBConnection: IDBConnection;
  let service: UploadArtifactService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new UploadArtifactService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getUploadArtifact', () => {
    it('should return a single upload artifact', async () => {
      const fakeUploadArtifact: UploadArtifact = {
        upload_artifact_id: 'artifact-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-id-1',
        role: UploadArtifactRoleEnum.FEATURE,
        upload_archive_id: null,
        path: null
      };

      const stub = sinon.stub(UploadArtifactRepository.prototype, 'getUploadArtifact').resolves(fakeUploadArtifact);

      const result = await service.getUploadArtifact('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
      expect(result).to.eql(fakeUploadArtifact);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArtifactRepository.prototype, 'getUploadArtifact').throws(new Error('DB Error'));

      try {
        await service.getUploadArtifact('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getUploadArtifacts', () => {
    it('should return all upload artifacts', async () => {
      const fakeUploadArtifacts: UploadArtifact[] = [
        {
          upload_artifact_id: 'artifact-1',
          upload_id: 'upload-1',
          artifact_id: 'artifact-id-1',
          role: UploadArtifactRoleEnum.ATTACHMENT,
          upload_archive_id: null,
          path: null
        },
        {
          upload_artifact_id: 'artifact-2',
          upload_id: 'upload-2',
          artifact_id: 'artifact-id-2',
          role: UploadArtifactRoleEnum.ATTACHMENT,
          upload_archive_id: null,
          path: null
        }
      ];

      const stub = sinon.stub(UploadArtifactRepository.prototype, 'getUploadArtifacts').resolves(fakeUploadArtifacts);

      const result = await service.getUploadArtifacts();

      expect(stub).to.have.been.calledWith();
      expect(result).to.eql(fakeUploadArtifacts);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArtifactRepository.prototype, 'getUploadArtifacts').throws(new Error('DB Error'));

      try {
        await service.getUploadArtifacts();
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertUploadArtifacts', () => {
    it('should insert upload artifacts in bulk and return ids', async () => {
      const fakeInput: CreateUploadArtifact[] = [
        {
          upload_id: 'upload-1',
          artifact_id: 'artifact-id-1',
          upload_archive_id: 'upload-archive-id-1',
          role: UploadArtifactRoleEnum.FEATURE
        }
      ];

      const stub = sinon
        .stub(UploadArtifactRepository.prototype, 'insertUploadArtifacts')
        .resolves([{ upload_artifact_id: 'artifact-new' }]);

      const result = await service.insertUploadArtifacts(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql([{ upload_artifact_id: 'artifact-new' }]);
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateUploadArtifact[] = [
        {
          upload_id: 'upload-1',
          artifact_id: 'artifact-id-1',
          upload_archive_id: 'upload-archive-id-1',
          role: UploadArtifactRoleEnum.FEATURE
        }
      ];

      sinon.stub(UploadArtifactRepository.prototype, 'insertUploadArtifacts').throws(new Error('Insert failed'));

      try {
        await service.insertUploadArtifacts(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('deleteUploadArtifactsByUploadId', () => {
    it('should delete archive-derived upload artifact rows for upload id', async () => {
      const stub = sinon.stub(UploadArtifactRepository.prototype, 'deleteUploadArtifactsByUploadId').resolves();

      await service.deleteUploadArtifactsByUploadId('upload-1');

      expect(stub).to.have.been.calledWith('upload-1');
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(UploadArtifactRepository.prototype, 'deleteUploadArtifactsByUploadId')
        .throws(new Error('Delete failed'));

      try {
        await service.deleteUploadArtifactsByUploadId('upload-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });

  describe('updateUploadArtifact', () => {
    it('should update an existing upload artifact and return its ID', async () => {
      const fakeInput: UpdateUploadArtifact = {
        upload_artifact_id: 'upload-artifact-id-1',
        upload_id: 'upload-new-id',
        upload_archive_id: 'upload-archive-id-1',
        artifact_id: 'artifact-new-id',
        role: UploadArtifactRoleEnum.FEATURE
      };

      const stub = sinon
        .stub(UploadArtifactRepository.prototype, 'updateUploadArtifact')
        .resolves({ upload_artifact_id: 'upload-artifact-id-1' });

      const result = await service.updateUploadArtifact('upload-artifact-id-1', fakeInput);

      expect(stub).to.have.been.calledWith('upload-artifact-id-1', fakeInput);
      expect(result).to.eql({ upload_artifact_id: 'upload-artifact-id-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateUploadArtifact = {
        upload_artifact_id: 'upload-artifact-id-1',
        upload_id: 'upload-new-id',
        upload_archive_id: 'upload-archive-id-1',
        artifact_id: 'artifact-new-id',
        role: UploadArtifactRoleEnum.FEATURE
      };

      sinon.stub(UploadArtifactRepository.prototype, 'updateUploadArtifact').throws(new Error('Update failed'));

      try {
        await service.updateUploadArtifact('artifact-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('deleteUploadArtifact', () => {
    it('should delete an upload artifact by ID', async () => {
      const stub = sinon.stub(UploadArtifactRepository.prototype, 'deleteUploadArtifact').resolves();

      await service.deleteUploadArtifact('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArtifactRepository.prototype, 'deleteUploadArtifact').throws(new Error('Delete failed'));

      try {
        await service.deleteUploadArtifact('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });
});
