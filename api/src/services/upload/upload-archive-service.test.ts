import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { CreateUploadArchive, UpdateUploadArchive, UploadArchive } from '../../models/upload-archive';
import { UploadArchiveRepository } from '../../repositories/upload/upload-archive-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { UploadArchiveService } from './upload-archive-service';

chai.use(sinonChai);

describe('UploadArchiveService', () => {
  let mockDBConnection: IDBConnection;
  let service: UploadArchiveService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new UploadArchiveService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getUploadArchive', () => {
    it('should return a single upload archive record', async () => {
      const fakeUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };

      const stub = sinon.stub(UploadArchiveRepository.prototype, 'getUploadArchive').resolves(fakeUploadArchive);

      const result = await service.getUploadArchive('archive-1');

      expect(stub).to.have.been.calledWith('archive-1');
      expect(result).to.eql(fakeUploadArchive);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArchiveRepository.prototype, 'getUploadArchive').rejects(new Error('DB Error'));

      try {
        await service.getUploadArchive('archive-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertUploadArchive', () => {
    it('should insert a new upload archive record and return its ID', async () => {
      const fakeInput: CreateUploadArchive = {
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };

      const stub = sinon
        .stub(UploadArchiveRepository.prototype, 'insertUploadArchive')
        .resolves({ upload_archive_id: 'archive-new' });

      const result = await service.insertUploadArchive(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ upload_archive_id: 'archive-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateUploadArchive = {
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.PENDING
      };

      sinon.stub(UploadArchiveRepository.prototype, 'insertUploadArchive').rejects(new Error('Insert failed'));

      try {
        await service.insertUploadArchive(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateUploadArchive', () => {
    it('should update an existing upload archive record and return its ID', async () => {
      const fakeInput: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      const stub = sinon
        .stub(UploadArchiveRepository.prototype, 'updateUploadArchive')
        .resolves({ upload_archive_id: 'archive-1' });

      const result = await service.updateUploadArchive('archive-1', fakeInput);

      expect(stub).to.have.been.calledWith('archive-1', fakeInput);
      expect(result).to.eql({ upload_archive_id: 'archive-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      sinon.stub(UploadArchiveRepository.prototype, 'updateUploadArchive').rejects(new Error('Update failed'));

      try {
        await service.updateUploadArchive('archive-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('updateUploadArchivesByUploadId', () => {
    it('should update multiple upload archive records for a given upload ID', async () => {
      const fakeInput: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      const stub = sinon
        .stub(UploadArchiveRepository.prototype, 'updateUploadArchivesByUploadId')
        .resolves([{ upload_archive_id: 'archive-1' }, { upload_archive_id: 'archive-2' }]);

      const result = await service.updateUploadArchivesByUploadId('upload-1', fakeInput);

      expect(stub).to.have.been.calledWith('upload-1', fakeInput);
      expect(result).to.have.length(2);
      expect(result[0]).to.eql({ upload_archive_id: 'archive-1' });
      expect(result[1]).to.eql({ upload_archive_id: 'archive-2' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateUploadArchive = {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      };

      sinon
        .stub(UploadArchiveRepository.prototype, 'updateUploadArchivesByUploadId')
        .rejects(new Error('Update failed'));

      try {
        await service.updateUploadArchivesByUploadId('upload-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('getUploadArchivesByUploadId', () => {
    it('should return all upload archive records for a given upload ID', async () => {
      const fakeUploadArchives: UploadArchive[] = [
        {
          upload_archive_id: 'archive-1',
          upload_id: 'upload-1',
          artifact_id: 'artifact-1',
          archive_status: ProcessStatusStatusEnum.PENDING
        },
        {
          upload_archive_id: 'archive-2',
          upload_id: 'upload-1',
          artifact_id: 'artifact-2',
          archive_status: ProcessStatusStatusEnum.COMPLETED
        }
      ];

      const stub = sinon
        .stub(UploadArchiveRepository.prototype, 'getUploadArchivesByUploadId')
        .resolves(fakeUploadArchives);

      const result = await service.getUploadArchivesByUploadId('upload-1');

      expect(stub).to.have.been.calledWith('upload-1');
      expect(result).to.eql(fakeUploadArchives);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArchiveRepository.prototype, 'getUploadArchivesByUploadId').rejects(new Error('DB Error'));

      try {
        await service.getUploadArchivesByUploadId('upload-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('deleteUploadArchive', () => {
    it('should delete an upload archive record by ID', async () => {
      const stub = sinon.stub(UploadArchiveRepository.prototype, 'deleteUploadArchive').resolves();

      await service.deleteUploadArchive('archive-1');

      expect(stub).to.have.been.calledWith('archive-1');
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(UploadArchiveRepository.prototype, 'deleteUploadArchive').rejects(new Error('Delete failed'));

      try {
        await service.deleteUploadArchive('archive-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });
});
