import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionUploadStatus } from '../models/submission-upload-status';
import { SubmissionUploadStatusRepository } from '../repositories/submission-upload-status-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionUploadStatusService } from './submission-upload-status-service';

chai.use(sinonChai);

describe('SubmissionUploadStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionUploadStatus', () => {
    it('should return submission upload status', async () => {
      const mockDBConnection = getMockDBConnection();

      const mockStatus: SubmissionUploadStatus = {
        submission_id: 123,
        upload: { upload_id: 'uuid-123', upload_status: 'completed' },
        upload_archives: [
          {
            upload_archive_id: 'uuid-archive',
            archive_status: 'completed',
            byte_size: 1024,
            security: 'clean'
          }
        ],
        artifacts: {
          feature: { count: 2, byte_size: 512 },
          attachment: { count: 1, byte_size: 256 }
        },
        scans: [],
        scan_files: []
      };

      const repoStub = sinon
        .stub(SubmissionUploadStatusRepository.prototype, 'getSubmissionUploadStatusById')
        .resolves(mockStatus);

      const service = new SubmissionUploadStatusService(mockDBConnection);
      const result = await service.getSubmissionUploadStatus(123);

      expect(repoStub).to.be.calledOnceWithExactly(123);
      expect(result).to.eql(mockStatus);
    });

    it('should propagate errors from the repository', async () => {
      const mockDBConnection = getMockDBConnection();

      const repoStub = sinon
        .stub(SubmissionUploadStatusRepository.prototype, 'getSubmissionUploadStatusById')
        .rejects(new Error('Database error'));

      const service = new SubmissionUploadStatusService(mockDBConnection);

      try {
        await service.getSubmissionUploadStatus(123);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(repoStub).to.be.calledOnceWithExactly(123);
        expect((error as Error).message).to.equal('Database error');
      }
    });
  });
});
