import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { SubmissionUpload } from '../models/submission-upload';
import { SubmissionFeatureErrorRepository } from '../repositories/submission-feature-error-repository';
import { SubmissionFeatureErrorService } from './submission-feature-error-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

chai.use(sinonChai);

describe('SubmissionFeatureErrorService', () => {
  const scope = { submissionId: 17, submissionUploadId: '11111111-1111-4111-8111-111111111111' };
  const upload = { submission_upload_id: scope.submissionUploadId, submission_id: 17 } as SubmissionUpload;

  afterEach(() => {
    sinon.restore();
  });

  describe('listSubmissionFeatureErrors', () => {
    it('preserves totals for a requested page beyond the last error', async () => {
      const ownership = sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId')
        .resolves(upload);
      const list = sinon.stub(SubmissionFeatureErrorRepository.prototype, 'listSubmissionFeatureErrors').resolves([]);
      const count = sinon.stub(SubmissionFeatureErrorRepository.prototype, 'countSubmissionFeatureErrors').resolves(11);
      const pagination = { page: 3, limit: 10, sort: 'count', order: 'desc' as const };
      const service = new SubmissionFeatureErrorService(getMockDBConnection());

      const result = await service.listSubmissionFeatureErrors(scope, pagination);

      expect(ownership).to.have.been.calledOnceWithExactly(17, scope.submissionUploadId);
      expect(list).to.have.been.calledOnceWithExactly(scope.submissionUploadId, pagination);
      expect(count).to.have.been.calledOnceWithExactly(scope.submissionUploadId);
      expect(result).to.eql({
        errors: [],
        pagination: { total: 11, per_page: 10, current_page: 3, last_page: 2, sort: 'count', order: 'desc' }
      });
    });

    it('returns a valid empty first page for an upload without errors', async () => {
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId').resolves(upload);
      sinon.stub(SubmissionFeatureErrorRepository.prototype, 'listSubmissionFeatureErrors').resolves([]);
      sinon.stub(SubmissionFeatureErrorRepository.prototype, 'countSubmissionFeatureErrors').resolves(0);
      const service = new SubmissionFeatureErrorService(getMockDBConnection());

      const result = await service.listSubmissionFeatureErrors(scope, { page: 1, limit: 10 });

      expect(result.errors).to.eql([]);
      expect(result.pagination.total).to.equal(0);
      expect(result.pagination.last_page).to.equal(1);
    });

    it('reads no errors for an upload that does not belong to the submission', async () => {
      const failure = new ApiNotFoundError('Submission upload not found');
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId').rejects(failure);
      const list = sinon.stub(SubmissionFeatureErrorRepository.prototype, 'listSubmissionFeatureErrors');
      const count = sinon.stub(SubmissionFeatureErrorRepository.prototype, 'countSubmissionFeatureErrors');
      const service = new SubmissionFeatureErrorService(getMockDBConnection());
      let caught: unknown;

      try {
        await service.listSubmissionFeatureErrors({ ...scope, submissionId: 8 }, { page: 1, limit: 10 });
      } catch (error) {
        caught = error;
      }

      expect(caught).to.equal(failure);
      expect(list).not.to.have.been.called;
      expect(count).not.to.have.been.called;
    });
  });
});
