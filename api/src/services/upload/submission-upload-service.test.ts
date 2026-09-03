import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import { ApiConflictError, ApiGeneralError } from '../../errors/api-error';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import { CreateSubmissionUpload, SubmissionUpload, UpdateSubmissionUpload } from '../../models/submission-upload';
import { SubmissionUploadProcessingStatus } from '../../models/submission-upload-processing-status';
import { BlueprintRepository } from '../../repositories/blueprint-repository';
import { SubmissionUploadProcessingStatusRepository } from '../../repositories/upload/submission-upload-processing-status-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { TeamService } from '../access-policy/team-service';
import { SubmissionService } from '../submission-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

describe('SubmissionUploadService', () => {
  let mockDBConnection: IDBConnection;
  let service: SubmissionUploadService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new SubmissionUploadService(mockDBConnection);
    sinon
      .stub(SubmissionUploadReviewStatusService.prototype, 'assertSubmissionUploadHasNoActivatedFeatures')
      .resolves();
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
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
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

  describe('getSubmissionUploadWithLock', () => {
    it('should return a single submission_upload record', async () => {
      const stub = sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 123,
        upload_id: 'upload-1',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

      const result = await service.getSubmissionUploadWithLock('artifact-1');

      expect(stub).to.have.been.calledWith('artifact-1');
      expect(result).to.deep.equal({
        submission_upload_id: 'artifact-1',
        submission_id: 123,
        upload_id: 'upload-1',
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadWithLock').throws(new Error('Query failed'));

      try {
        await service.getSubmissionUploadWithLock('artifact-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Query failed');
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
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'uploaded',
          ticket_id: '11111111-1111-1111-1111-111111111111',
          blueprint_id: 1
        },
        {
          submission_upload_id: 'artifact-2',
          submission_id: mockSubmissionId,
          upload_id: 'upload-2',
          team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          status: 'uploaded',
          ticket_id: '22222222-2222-2222-2222-222222222222',
          blueprint_id: 1
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
        status: 'uploaded',
        blueprint_id: 7
      };

      const createTeam = sinon.stub(TeamService.prototype, 'createTeam').resolves({
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Submission Upload Team upload-1',
        description: null,
        member_count: 1
      });
      const stub = sinon
        .stub(SubmissionUploadRepository.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'artifact-new' });
      const lockUploads = sinon
        .stub(SubmissionUploadRepository.prototype, 'lockSubmissionUploadsForSubmissionId')
        .resolves();
      const lockSubmission = sinon
        .stub(SubmissionService.prototype, 'lockSubmissionFeatureStateForSubmissionId')
        .resolves();
      const insertProcessingStatus = sinon
        .stub(SubmissionUploadProcessingStatusRepository.prototype, 'insertSubmissionUploadProcessingStatus')
        .resolves(buildProcessingStatus('artifact-new', 'uploaded'));

      const result = await service.insertSubmissionUpload(fakeInput, 2, [2]);

      expect(createTeam).to.have.been.calledOnceWith(
        sinon.match({
          system_user_ids: [2]
        })
      );
      expect(stub).to.have.been.calledWith({
        ...fakeInput,
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      });
      expect(lockUploads).to.have.been.calledOnceWith(1);
      expect(lockSubmission).to.have.been.calledOnceWith(1);
      expect(lockUploads).to.have.been.calledBefore(lockSubmission);
      expect(insertProcessingStatus).to.have.been.calledOnceWith('artifact-new', 'uploaded');
      expect(stub).to.have.been.calledBefore(insertProcessingStatus);
      expect(result).to.eql({ submission_upload_id: 'artifact-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateSubmissionUpload = {
        submission_id: 1,
        upload_id: 'upload-1',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'uploaded',
        blueprint_id: 7
      };

      sinon.stub(TeamService.prototype, 'createTeam').resolves({
        team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Submission Upload Team upload-1',
        description: null,
        member_count: 0
      });
      sinon.stub(SubmissionUploadRepository.prototype, 'lockSubmissionUploadsForSubmissionId').resolves();
      sinon.stub(SubmissionService.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
      sinon.stub(SubmissionUploadRepository.prototype, 'insertSubmissionUpload').throws(new Error('Insert failed'));

      try {
        await service.insertSubmissionUpload(fakeInput, 2);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('resolveBlueprintIdForUpload', () => {
    it('uses a supplied blueprint_id when it is available', async () => {
      const getActiveStub = sinon.stub(BlueprintRepository.prototype, 'findActiveBlueprintById').resolves(5);
      const priorStub = sinon.stub(SubmissionUploadRepository.prototype, 'findMostRecentBlueprintIdBySubmissionId');
      const defaultStub = sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId');

      const result = await service.resolveBlueprintIdForUpload(1, 5);

      expect(result).to.equal(5);
      expect(getActiveStub).to.have.been.calledOnceWith(5);
      // A supplied id short-circuits the prior-upload and default fallbacks.
      expect(priorStub).to.not.have.been.called;
      expect(defaultStub).to.not.have.been.called;
    });

    it('throws HTTP400 when a supplied blueprint_id is not available', async () => {
      sinon.stub(BlueprintRepository.prototype, 'findActiveBlueprintById').resolves(null);

      try {
        await service.resolveBlueprintIdForUpload(1, 999);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Requested Blueprint is not available');
      }
    });

    it('defaults to the most recent prior upload Blueprint when none is supplied', async () => {
      const priorStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'findMostRecentBlueprintIdBySubmissionId')
        .resolves(8);
      const defaultStub = sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId');

      const result = await service.resolveBlueprintIdForUpload(1);

      expect(result).to.equal(8);
      expect(priorStub).to.have.been.calledOnceWith(1);
      // The prior upload Blueprint wins over the system default for re-submissions.
      expect(defaultStub).to.not.have.been.called;
    });

    it('falls back to the default Blueprint when there is no prior upload', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'findMostRecentBlueprintIdBySubmissionId').resolves(null);
      const defaultStub = sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId').resolves(1);

      const result = await service.resolveBlueprintIdForUpload(1);

      expect(result).to.equal(1);
      expect(defaultStub).to.have.been.calledOnce;
    });

    it('throws when no prior upload and no default Blueprint exist', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'findMostRecentBlueprintIdBySubmissionId').resolves(null);
      sinon.stub(BlueprintRepository.prototype, 'findDefaultBlueprintId').resolves(null);

      try {
        await service.resolveBlueprintIdForUpload(1);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
        expect((error as ApiGeneralError).message).to.equal('No default Blueprint is configured');
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
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

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
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

      try {
        await service.updateSubmissionUpload('artifact-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });

    it('rejects updates after the upload has been approved', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexed',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const guard = SubmissionUploadReviewStatusService.prototype
        .assertSubmissionUploadHasNoActivatedFeatures as sinon.SinonStub;
      guard.rejects(new HTTP409('Approved submission uploads are immutable'));
      const update = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUpload');

      try {
        await service.updateSubmissionUpload('artifact-1', { comment: 'changed' });
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
      expect(update).not.to.have.been.called;
    });
  });

  describe('deleteSubmissionUpload', () => {
    const submissionId = '11111111-1111-1111-1111-111111111111';
    const submissionUploadId = '22222222-2222-2222-2222-222222222222';
    const teamId = '33333333-3333-3333-3333-333333333333';

    beforeEach(() => {
      sinon.stub(service, 'getSubmissionUploadBySubmissionUuid').resolves({
        submission_upload_id: submissionUploadId,
        submission_id: 1,
        upload_id: '44444444-4444-4444-4444-444444444444',
        team_id: teamId,
        status: 'uploaded',
        ticket_id: '55555555-5555-5555-5555-555555555555',
        blueprint_id: 1,
        comment: null
      });
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: submissionUploadId,
        submission_id: 1,
        upload_id: '44444444-4444-4444-4444-444444444444',
        team_id: teamId,
        status: 'uploaded',
        ticket_id: '55555555-5555-5555-5555-555555555555',
        blueprint_id: 1,
        comment: null
      });
    });

    it('soft-deletes the upload, records deleted status, and retires its team', async () => {
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: submissionUploadId,
        status: 'submitted'
      });
      const deleteUploadStub = sinon.stub(SubmissionUploadRepository.prototype, 'deleteSubmissionUpload').resolves();
      // A delete records the status directly — it must not route through the reconciliation-aware
      // update path (which now lives on SubmissionUploadService).
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusService.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 2,
          submission_upload_id: submissionUploadId,
          status: 'deleted'
        });
      const deleteTeamStub = sinon.stub(TeamService.prototype, 'deleteTeam').resolves();

      await service.deleteSubmissionUpload(submissionId, submissionUploadId);

      expect(service.getSubmissionUploadBySubmissionUuid).to.have.been.calledOnceWith(submissionId, submissionUploadId);
      expect(deleteUploadStub).to.have.been.calledOnceWith(submissionUploadId);
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: submissionUploadId,
        status: 'deleted'
      });
      expect(deleteTeamStub).to.have.been.calledOnceWith(teamId);
    });

    it('rejects a reviewed upload without deleting the upload or its team', async () => {
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: submissionUploadId,
        status: 'approved'
      });
      const deleteUploadStub = sinon.stub(SubmissionUploadRepository.prototype, 'deleteSubmissionUpload');
      const insertStatusStub = sinon.stub(
        SubmissionUploadReviewStatusService.prototype,
        'insertSubmissionUploadReviewStatus'
      );
      const deleteTeamStub = sinon.stub(TeamService.prototype, 'deleteTeam');

      try {
        await service.deleteSubmissionUpload(submissionId, submissionUploadId);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect(deleteUploadStub).not.to.have.been.called;
        expect(insertStatusStub).not.to.have.been.called;
        expect(deleteTeamStub).not.to.have.been.called;
      }
    });

    it('rejects deletion when the upload has been approved', async () => {
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: submissionUploadId,
        status: 'submitted'
      });
      const guard = SubmissionUploadReviewStatusService.prototype
        .assertSubmissionUploadHasNoActivatedFeatures as sinon.SinonStub;
      guard.rejects(new HTTP409('Approved submission uploads are immutable'));
      const deleteUpload = sinon.stub(SubmissionUploadRepository.prototype, 'deleteSubmissionUpload');

      try {
        await service.deleteSubmissionUpload(submissionId, submissionUploadId);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }
      expect(deleteUpload).not.to.have.been.called;
    });
  });

  describe('soft delete immutability', () => {
    it('guards a single upload before soft deletion', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const remove = sinon.stub(SubmissionUploadRepository.prototype, 'softDeleteSubmissionUpload').resolves();

      await service.softDeleteSubmissionUpload('artifact-1');

      expect(remove).to.have.been.calledOnceWith('artifact-1');
    });

    it('locks and guards every upload before bulk soft deletion', async () => {
      const lock = sinon.stub(SubmissionUploadRepository.prototype, 'lockSubmissionUploadsForSubmissionId').resolves();
      const bulkGuard = sinon
        .stub(SubmissionUploadReviewStatusService.prototype, 'assertSubmissionHasNoActivatedFeatures')
        .resolves();
      const remove = sinon
        .stub(SubmissionUploadRepository.prototype, 'softDeleteSubmissionUploadsBySubmissionId')
        .resolves(2);

      expect(await service.softDeleteSubmissionUploadsBySubmissionId(1)).to.equal(2);
      expect(lock).to.have.been.calledOnceWith(1);
      expect(bulkGuard).to.have.been.calledOnceWith(1);
      expect(remove).to.have.been.calledOnceWith(1);
    });
  });

  describe('transitionSubmissionUploadStatus', () => {
    it('ends superseded rows, updates the current status and inserts the history row in that order', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('reconciled'));
      const { endStub, updateStub, insertStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadStatus('artifact-1', 'indexing', ['reconciled']);

      expect(endStub).to.have.been.calledOnceWith('artifact-1', ['indexing', 'indexed', 'invalid', 'failed']);
      expect(updateStub).to.have.been.calledOnceWith('artifact-1', 'indexing');
      expect(insertStub).to.have.been.calledOnceWith('artifact-1', 'indexing');
      expect(endStub).to.have.been.calledBefore(updateStub);
      expect(updateStub).to.have.been.calledBefore(insertStub);
    });

    it('restarting from an earlier stage ends that stage, every later stage and the failure outcomes', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('failed'));
      const { endStub, insertStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadStatus('artifact-1', 'ingesting', ['failed']);

      expect(endStub).to.have.been.calledOnceWith('artifact-1', [
        'ingesting',
        'ingested',
        'reconciling',
        'reconciled',
        'promoting',
        'promoted',
        'indexing',
        'indexed',
        'invalid',
        'failed'
      ]);
      expect(insertStub).to.have.been.calledOnceWith('artifact-1', 'ingesting');
    });

    it('writes nothing when the requested status equals the current status', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('ingesting'));
      const { endStub, updateStub, insertStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadStatus('artifact-1', 'ingesting', ['uploaded']);

      expect(endStub).not.to.have.been.called;
      expect(updateStub).not.to.have.been.called;
      expect(insertStub).not.to.have.been.called;
    });

    it('throws ApiConflictError and writes nothing when current status is not in the allowed set', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('indexed'));
      const { endStub, updateStub, insertStub } = stubTransitionWrites();

      try {
        await service.transitionSubmissionUploadStatus('artifact-1', 'ingesting', ['uploaded', 'ingesting']);
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }

      expect(endStub).not.to.have.been.called;
      expect(updateStub).not.to.have.been.called;
      expect(insertStub).not.to.have.been.called;
    });
  });

  describe('transitionSubmissionUploadToIngesting', () => {
    it('updates status from uploaded to ingesting', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('uploaded'));
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIngesting('artifact-1');

      expect(updateStub).to.have.been.calledWith('artifact-1', 'ingesting');
    });

    it('does not update when already ingesting', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('ingesting'));
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIngesting('artifact-1');

      expect(updateStub).not.to.have.been.called;
    });

    it('throws ApiConflictError from a later stage', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('ingested'));
      stubTransitionWrites();

      try {
        await service.transitionSubmissionUploadToIngesting('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToInvalid', () => {
    it('updates status from any non-terminal stage to invalid and ends only a prior invalid row', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('promoting'));
      const { endStub, updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToInvalid('artifact-1');

      expect(endStub).to.have.been.calledOnceWith('artifact-1', ['invalid']);
      expect(updateStub).to.have.been.calledWith('artifact-1', 'invalid');
    });

    it('throws ApiConflictError from indexed', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('indexed'));
      stubTransitionWrites();

      try {
        await service.transitionSubmissionUploadToInvalid('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToFailed', () => {
    it('updates status from any non-terminal stage to failed', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('reconciling'));
      const { endStub, updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToFailed('artifact-1');

      expect(endStub).to.have.been.calledOnceWith('artifact-1', ['failed']);
      expect(updateStub).to.have.been.calledWith('artifact-1', 'failed');
    });

    it('does not update when already failed', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('failed'));
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToFailed('artifact-1');

      expect(updateStub).not.to.have.been.called;
    });

    it('throws ApiConflictError from invalid', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves(buildUpload('invalid'));
      stubTransitionWrites();

      try {
        await service.transitionSubmissionUploadToFailed('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToIngested', () => {
    it('updates status from ingesting to ingested', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'ingesting',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIngested('artifact-1');
      expect(updateStub).to.have.been.calledWith('artifact-1', 'ingested');
    });

    it('throws ApiConflictError from invalid source state', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexed',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

      try {
        await service.transitionSubmissionUploadToIngested('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToIndexing', () => {
    it('updates status from reconciled to indexing', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'reconciled',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIndexing('artifact-1');
      expect(updateStub).to.have.been.calledWith('artifact-1', 'indexing');
    });

    it('does not update when already indexing', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexing',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIndexing('artifact-1');
      expect(updateStub).not.to.have.been.called;
    });

    it('throws ApiConflictError from invalid source state', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

      try {
        await service.transitionSubmissionUploadToIndexing('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('transitionSubmissionUploadToIndexed', () => {
    it('updates status from indexing to indexed', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexing',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIndexed('artifact-1');
      expect(updateStub).to.have.been.calledWith('artifact-1', 'indexed');
    });

    it('does not update when already indexed', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'indexed',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });
      const { updateStub } = stubTransitionWrites();

      await service.transitionSubmissionUploadToIndexed('artifact-1');
      expect(updateStub).not.to.have.been.called;
    });

    it('throws ApiConflictError from invalid source state', async () => {
      sinon.stub(service, 'getSubmissionUploadWithLock').resolves({
        submission_upload_id: 'artifact-1',
        submission_id: 1,
        upload_id: 'upload-1',
        status: 'ingested',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      });

      try {
        await service.transitionSubmissionUploadToIndexed('artifact-1');
        expect.fail('Expected ApiConflictError not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiConflictError);
      }
    });
  });
});

/**
 * Build a locked submission upload row in the given processing status.
 *
 * @param {SubmissionUpload['status']} status Current processing status.
 * @returns {SubmissionUpload} Upload row.
 */
const buildUpload = (status: SubmissionUpload['status']): SubmissionUpload => ({
  submission_upload_id: 'artifact-1',
  submission_id: 1,
  upload_id: 'upload-1',
  team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  status,
  ticket_id: '11111111-1111-1111-1111-111111111111',
  blueprint_id: 1
});

/**
 * Build an active processing status history row.
 *
 * @param {string} submissionUploadId Owning submission upload.
 * @param {SubmissionUpload['status']} status Processing status recorded by the row.
 * @returns {SubmissionUploadProcessingStatus} History row.
 */
const buildProcessingStatus = (
  submissionUploadId: string,
  status: SubmissionUpload['status']
): SubmissionUploadProcessingStatus => ({
  submission_upload_status_id: 1,
  submission_upload_id: submissionUploadId,
  status,
  record_end_date: null,
  create_date: new Date('2026-09-03T00:00:00.000Z'),
  create_user: 1
});

/**
 * Stub the three repository writes a status transition performs.
 *
 * @returns Stubs for ending superseded rows, updating the current status and inserting the history row.
 */
const stubTransitionWrites = () => ({
  endStub: sinon
    .stub(SubmissionUploadProcessingStatusRepository.prototype, 'endActiveSubmissionUploadProcessingStatuses')
    .resolves([]),
  updateStub: sinon
    .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadStatus')
    .resolves({ submission_upload_id: 'artifact-1' }),
  insertStub: sinon
    .stub(SubmissionUploadProcessingStatusRepository.prototype, 'insertSubmissionUploadProcessingStatus')
    .resolves(buildProcessingStatus('artifact-1', 'ingesting'))
});
