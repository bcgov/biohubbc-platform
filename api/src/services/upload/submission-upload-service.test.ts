import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
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
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
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
          upload_id: 'upload-1',
          status: 'uploaded',
          ticket_id: '11111111-1111-1111-1111-111111111111'
        },
        {
          submission_upload_id: 'artifact-2',
          submission_id: mockSubmissionId,
          upload_id: 'upload-2',
          status: 'uploaded',
          ticket_id: '22222222-2222-2222-2222-222222222222'
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
        upload_id: 'upload-1',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'uploaded'
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
        upload_id: 'upload-1',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'uploaded'
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
        upload_id: 'upload-2',
        ticket_id: '22222222-2222-2222-2222-222222222222'
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
        upload_id: 'upload-2',
        ticket_id: '22222222-2222-2222-2222-222222222222'
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
    it('should soft-delete a submission_upload record', async () => {
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

  describe('transitionSubmissionUploadStatus', () => {
    it('updates status when current status is in the allowed set', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
      const updateStub = sinon.stub(service, 'updateSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1'
      });

      await service.transitionSubmissionUploadStatus('artifact-1', 'ingesting', ['uploaded', 'ingesting']);

      expect(updateStub).to.have.been.calledWith('artifact-1', { status: 'ingesting' });
    });

    it('throws ApiConflictError when current status is not in the allowed set', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexed',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });

      try {
        await service.transitionSubmissionUploadStatus('artifact-1', 'ingesting', ['uploaded', 'ingesting']);
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToIngesting', () => {
    it('updates status from uploaded to ingesting', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
      const updateStub = sinon.stub(service, 'updateSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1'
      });

      await service.transitionSubmissionUploadToIngesting('artifact-1');
      expect(updateStub).to.have.been.calledWith('artifact-1', { status: 'ingesting' });
    });

    it('no-ops when already ingesting', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'ingesting',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
      const updateStub = sinon.stub(service, 'updateSubmissionUpload');

      await service.transitionSubmissionUploadToIngesting('artifact-1');
      expect(updateStub.called).to.equal(false);
    });
  });

  describe('transitionSubmissionUploadToIngested', () => {
    it('updates status from ingesting to ingested', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'ingesting',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
      const updateStub = sinon.stub(service, 'updateSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1'
      });

      await service.transitionSubmissionUploadToIngested('artifact-1');
      expect(updateStub).to.have.been.calledWith('artifact-1', { status: 'ingested' });
    });

    it('throws ApiConflictError from invalid source state', async () => {
      sinon.stub(service, 'getSubmissionUpload').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexed',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });

      try {
        await service.transitionSubmissionUploadToIngested('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

});
