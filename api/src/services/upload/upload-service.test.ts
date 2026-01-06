import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateUpload, UpdateUpload, Upload, UploadStatusEnum } from '../../models/upload';
import { UploadRepository } from '../../repositories/upload/upload-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { UploadService } from './upload-service';

chai.use(sinonChai);

describe('UploadService', () => {
  let mockDBConnection: any;
  let uploadService: UploadService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    uploadService = new UploadService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getUpload', () => {
    it('should retrieve a single upload record', async () => {
      const fakeUpload: Upload = {
        upload_id: '123',
        status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date().toISOString(),
        create_user: 1,
        s3_upload_id: 's3-upload-id'
      };

      const stub = sinon.stub(UploadRepository.prototype, 'getUpload').resolves(fakeUpload);

      const result = await uploadService.getUpload('123');

      expect(stub).to.have.been.calledWith('123');
      expect(result).to.eql(fakeUpload);
    });

    it('should throw an error if repository fails', async () => {
      const stub = sinon.stub(UploadRepository.prototype, 'getUpload').rejects(new Error('DB error'));

      try {
        await uploadService.getUpload('123');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(stub).to.have.been.calledWith('123');
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('getUploads', () => {
    it('should retrieve all uploads', async () => {
      const fakeUploads: Upload[] = [
        {
          upload_id: '1',
          status: UploadStatusEnum.COMPLETED,
          record_end_date: new Date().toISOString(),
          create_user: 1,
          s3_upload_id: 's3-upload-id'
        },
        {
          upload_id: '2',
          status: UploadStatusEnum.COMPLETED,
          record_end_date: '2025-12-31',
          create_user: 1,
          s3_upload_id: 's3-upload-id'
        }
      ];

      const stub = sinon.stub(UploadRepository.prototype, 'getUploads').resolves(fakeUploads);

      const result = await uploadService.getUploads();

      expect(stub).to.have.been.called;
      expect(result).to.eql(fakeUploads);
    });

    it('should throw an error if repository fails', async () => {
      const stub = sinon.stub(UploadRepository.prototype, 'getUploads').rejects(new Error('DB error'));

      try {
        await uploadService.getUploads();
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(stub).to.have.been.called;
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('insertUpload', () => {
    it('should insert a new upload', async () => {
      const newUpload: CreateUpload = {
        status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date().toISOString(),
        s3_upload_id: 's3-upload-id'
      };

      const stub = sinon.stub(UploadRepository.prototype, 'insertUpload').resolves({ upload_id: '123' });

      const result = await uploadService.insertUpload(newUpload);

      expect(stub).to.have.been.calledWith(newUpload);
      expect(result).to.eql({ upload_id: '123' });
    });

    it('should throw an error if repository fails', async () => {
      const newUpload: CreateUpload = {
        status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date().toISOString(),

        s3_upload_id: 's3-upload-id'
      };

      const stub = sinon.stub(UploadRepository.prototype, 'insertUpload').rejects(new Error('DB error'));

      try {
        await uploadService.insertUpload(newUpload);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(stub).to.have.been.calledWith(newUpload);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('updateUpload', () => {
    it('should update an existing upload', async () => {
      const updateData: UpdateUpload = {
        status: UploadStatusEnum.COMPLETED
      };

      const stub = sinon.stub(UploadRepository.prototype, 'updateUpload').resolves({ upload_id: '123' });

      const result = await uploadService.updateUpload('123', updateData);

      expect(stub).to.have.been.calledWith('123', updateData);
      expect(result).to.eql({ upload_id: '123' });
    });

    it('should throw an error if repository fails', async () => {
      const updateData: UpdateUpload = {
        status: UploadStatusEnum.COMPLETED
      };

      const stub = sinon.stub(UploadRepository.prototype, 'updateUpload').rejects(new Error('DB error'));

      try {
        await uploadService.updateUpload('123', updateData);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(stub).to.have.been.calledWith('123', updateData);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('deleteUpload', () => {
    it('should delete an upload', async () => {
      const stub = sinon.stub(UploadRepository.prototype, 'deleteUpload').resolves();

      await uploadService.deleteUpload('123');

      expect(stub).to.have.been.calledWith('123');
    });

    it('should throw an error if repository fails', async () => {
      const stub = sinon.stub(UploadRepository.prototype, 'deleteUpload').rejects(new Error('DB error'));

      try {
        await uploadService.deleteUpload('123');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(stub).to.have.been.calledWith('123');
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });
});
