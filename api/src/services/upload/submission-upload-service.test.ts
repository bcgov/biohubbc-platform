import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import { CreateSubmissionUpload, SubmissionUpload, UpdateSubmissionUpload } from '../../models/submission-upload';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

describe('SubmissionUploadService', () => {
  let mockDBConnection: IDBConnection;
  let service: SubmissionUploadService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new SubmissionUploadService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionUpload', () => {
    it('should return a single submission_upload record', async () => {
      const fakeSubmissionUpload: SubmissionUpload = {
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1'
      };

      const stub = sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUpload')
        .resolves(fakeSubmissionUpload);

      const result = await service.getSubmissionUpload('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
      expect(result).to.eql(fakeSubmissionUpload);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUpload').throws(new Error('DB Error'));

      try {
        await service.getSubmissionUpload('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('getSubmissionUploadsBySubmissionId', () => {
    it('should return all submission_upload records', async () => {
      const mockSubmissionId = 1;
      const fakeSubmissionUploads: SubmissionUpload[] = [
        {
          submission_upload_id: 'artifact-1',
          submission_id: mockSubmissionId,
          upload_id: 'upload-1'
        },
        {
          submission_upload_id: 'artifact-2',
          submission_id: mockSubmissionId,
          upload_id: 'upload-2'
        }
      ];

      const stub = sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadsBySubmissionId')
        .resolves(fakeSubmissionUploads);

      const result = await service.getSubmissionUploadsBySubmissionId(mockSubmissionId);

      expect(stub).to.have.been.calledWith();
      expect(result).to.eql(fakeSubmissionUploads);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadsBySubmissionId')
        .throws(new Error('DB Error'));

      try {
        await service.getSubmissionUploadsBySubmissionId(1);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertSubmissionUpload', () => {
    it('should insert a new submission_upload record and return its ID', async () => {
      const fakeInput: CreateSubmissionUpload = {
        submission_id: 1,
        upload_id: 'upload-1'
      };

      const stub = sinon
        .stub(SubmissionUploadRepository.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'artifact-new' });

      const result = await service.insertSubmissionUpload(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ submission_upload_id: 'artifact-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateSubmissionUpload = {
        submission_id: 1,
        upload_id: 'upload-1'
      };

      sinon.stub(SubmissionUploadRepository.prototype, 'insertSubmissionUpload').throws(new Error('Insert failed'));

      try {
        await service.insertSubmissionUpload(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateSubmissionUpload', () => {
    it('should update an existing submission_upload record and return its ID', async () => {
      const fakeInput: UpdateSubmissionUpload = {
        submission_id: 2,
        upload_id: 'upload-2'
      };

      const stub = sinon
        .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUpload')
        .resolves({ submission_upload_id: 'artifact-1' });

      const result = await service.updateSubmissionUpload('artifact-1', fakeInput);

      expect(stub).to.have.been.calledWith('artifact-1', fakeInput);
      expect(result).to.eql({ submission_upload_id: 'artifact-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateSubmissionUpload = {
        submission_id: 2,
        upload_id: 'upload-2'
      };

      sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUpload').throws(new Error('Update failed'));

      try {
        await service.updateSubmissionUpload('artifact-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('deleteSubmissionUpload', () => {
    it('should delete a submission_upload record', async () => {
      const stub = sinon.stub(SubmissionUploadRepository.prototype, 'deleteSubmissionUpload').resolves();

      await service.deleteSubmissionUpload('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'deleteSubmissionUpload').throws(new Error('Delete failed'));

      try {
        await service.deleteSubmissionUpload('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Delete failed');
      }
    });
  });
});
