import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { SubmissionUploadStatusRepository } from './submission-upload-status-repository';

chai.use(sinonChai);

describe('SubmissionUploadStatusRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionUploadStatusById', () => {
    it('should return submission upload status', async () => {
      const submissionId = 123;

      const mockResponse = {
        rowCount: 1,
        rows: [
          {
            submission_id: submissionId,
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
          }
        ]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockResponse
      });

      const repo = new SubmissionUploadStatusRepository(mockDBConnection);
      const result = await repo.getSubmissionUploadStatusById(submissionId);

      expect(result.submission_id).to.equal(submissionId);
      expect(result.upload.upload_id).to.equal('uuid-123');
      expect(result.upload_archives[0]?.archive_status).to.equal('completed');
      expect(result.artifacts.feature.count).to.equal(2);
      expect(result.artifacts.attachment.byte_size).to.equal(256);
    });

    it('should throw error if no rows returned', async () => {
      const submissionId = 999;

      const mockResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockResponse
      });

      const repo = new SubmissionUploadStatusRepository(mockDBConnection);

      try {
        await repo.getSubmissionUploadStatusById(submissionId);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as ApiNotFoundError).message).to.equal(`Submission upload status not found`);
      }
    });

    it('should throw error if SQL query fails', async () => {
      const submissionId = 123;

      const mockDBConnection = getMockDBConnection({
        knex: () => {
          throw new Error('Database error');
        }
      });

      const repo = new SubmissionUploadStatusRepository(mockDBConnection);

      try {
        await repo.getSubmissionUploadStatusById(submissionId);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Database error');
      }
    });
  });
});
