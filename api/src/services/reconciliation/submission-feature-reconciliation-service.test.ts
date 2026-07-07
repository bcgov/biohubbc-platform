import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { HTTP400, HTTP409, HTTP500 } from '../../errors/http-error';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeatureDerivedStateRepository } from '../../repositories/reconciliation/submission-feature-derived-state-repository';
import { SubmissionFeatureLogRepository } from '../../repositories/reconciliation/submission-feature-log-repository';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SubmissionFeatureClosureService } from '../submission-feature-closure-service';
import { SubmissionUploadService } from '../upload/submission-upload-service';
import { SubmissionFeatureReconciliationService } from './submission-feature-reconciliation-service';

chai.use(sinonChai);

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

const buildSubmissionUpload = (overrides?: Partial<SubmissionUpload>): SubmissionUpload =>
  ({
    submission_upload_id: UPLOAD_ID,
    submission_id: 42,
    upload_id: 'a1b2c3d4-0000-0000-0000-000000000000',
    status: 'indexed',
    ticket_id: 'b2c3d4e5-0000-0000-0000-000000000000',
    blueprint_id: 1,
    ...overrides
  } as SubmissionUpload);

describe('SubmissionFeatureReconciliationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const stubHappyPath = () => {
    const stubs = {
      getUpload: sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves(buildSubmissionUpload()),
      duplicateCount: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'getPendingDuplicateKeyRowCount')
        .resolves(0),
      deleteRecords: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'deleteReconciliationRecordsBySubmissionUploadId')
        .resolves(),
      classify: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'insertReconciliationRecordsFromClassification')
        .resolves([
          { outcome: 'new', count: 2 },
          { outcome: 'unchanged', count: 1 },
          { outcome: 'superseded', count: 1 }
        ]),
      endSuperseded: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'endSupersededBaselineRows')
        .resolves(1),
      endUnchanged: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'endUnchangedIncomingRows')
        .resolves(1),
      endConflict: sinon
        .stub(SubmissionFeatureReconciliationRepository.prototype, 'endConflictIncomingRows')
        .resolves(0),
      publish: sinon.stub(SubmissionFeatureReconciliationRepository.prototype, 'publishIncomingRows').resolves(3),
      logSuperseded: sinon
        .stub(SubmissionFeatureLogRepository.prototype, 'insertSupersededLogRecordsFromReconciliation')
        .resolves(1),
      repointParents: sinon
        .stub(SubmissionFeatureDerivedStateRepository.prototype, 'repointParentLinksToActiveRows')
        .resolves(0),
      repointReferences: sinon
        .stub(SubmissionFeatureDerivedStateRepository.prototype, 'repointFeaturePropertyReferencesToActiveRows')
        .resolves(0),
      repointRelationships: sinon
        .stub(SubmissionFeatureDerivedStateRepository.prototype, 'repointFeatureRelationshipsToActiveRows')
        .resolves(0),
      repointAnchors: sinon
        .stub(SubmissionFeatureDerivedStateRepository.prototype, 'repointSecurityScopeAnchorsToActiveRows')
        .resolves(0),
      carryForward: sinon
        .stub(SubmissionFeatureDerivedStateRepository.prototype, 'carryForwardSecurityRulesToReplacementRows')
        .resolves(0),
      closure: sinon
        .stub(SubmissionFeatureClosureService.prototype, 'computeClosureForSubmission')
        .resolves({ insertedCount: 10 })
    };

    return stubs;
  };

  describe('reconcileAndActivateSubmissionUpload', () => {
    it('acquires the per-submission advisory lock before touching feature state', async () => {
      const stubs = stubHappyPath();
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const service = new SubmissionFeatureReconciliationService(getMockDBConnection({ sql: sqlStub }));

      await service.reconcileAndActivateSubmissionUpload(UPLOAD_ID);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('pg_advisory_xact_lock');
      expect(sqlText).to.include('hashtextextended');
      expect(sqlStub).to.have.been.calledBefore(stubs.duplicateCount);
    });

    it('runs classification and lifecycle steps in the index-safe order', async () => {
      const stubs = stubHappyPath();
      const service = new SubmissionFeatureReconciliationService(
        getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 1)) })
      );

      const counts = await service.reconcileAndActivateSubmissionUpload(UPLOAD_ID);

      expect(counts).to.eql({ new: 2, unchanged: 1, superseded: 1, conflict: 0 });
      expect(stubs.deleteRecords).to.have.been.calledOnceWith(UPLOAD_ID);
      expect(stubs.classify).to.have.been.calledOnceWith(UPLOAD_ID, 42);
      // Predecessors must be ended before replacements are published — the partial unique
      // index is checked per statement.
      expect(stubs.endSuperseded).to.have.been.calledBefore(stubs.publish);
      expect(stubs.endUnchanged).to.have.been.calledBefore(stubs.publish);
      expect(stubs.endConflict).to.have.been.calledOnceWith(UPLOAD_ID);
      expect(stubs.endConflict).to.have.been.calledBefore(stubs.publish);
      // The superseded log records completed transitions: after publish, before healing,
      // so a chain-conflict unique violation aborts the approval before any healing work.
      expect(stubs.logSuperseded).to.have.been.calledOnceWith(UPLOAD_ID);
      expect(stubs.publish).to.have.been.calledBefore(stubs.logSuperseded);
      expect(stubs.logSuperseded).to.have.been.calledBefore(stubs.repointParents);
      // Derived healing and closure run after publication, closure last.
      expect(stubs.publish).to.have.been.calledBefore(stubs.repointParents);
      expect(stubs.carryForward).to.have.been.calledOnceWith(UPLOAD_ID);
      expect(stubs.closure).to.have.been.calledOnceWith(42);
      expect(stubs.repointAnchors).to.have.been.calledBefore(stubs.closure);
    });

    it('throws HTTP500 and stops before healing when the superseded tallies diverge', async () => {
      const stubs = stubHappyPath();
      // Classification reports 1 superseded, but the soft-end pass claims 2 rows ended.
      stubs.endSuperseded.resolves(2);
      const service = new SubmissionFeatureReconciliationService(
        getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 1)) })
      );

      try {
        await service.reconcileAndActivateSubmissionUpload(UPLOAD_ID);
        expect.fail('Expected HTTP500');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP500);
        expect((error as HTTP500).message).to.equal('Superseded feature lifecycle records diverged during approval');
      }

      expect(stubs.logSuperseded).to.have.been.calledOnce;
      expect(stubs.repointParents).not.to.have.been.called;
      expect(stubs.closure).not.to.have.been.called;
    });

    it('throws HTTP400 before any writes when the upload is not indexed', async () => {
      const stubs = stubHappyPath();
      stubs.getUpload.resolves(buildSubmissionUpload({ status: 'invalid' }));
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const service = new SubmissionFeatureReconciliationService(getMockDBConnection({ sql: sqlStub }));

      try {
        await service.reconcileAndActivateSubmissionUpload(UPLOAD_ID);
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload must be fully indexed before approval');
      }

      expect(sqlStub).not.to.have.been.called;
      expect(stubs.deleteRecords).not.to.have.been.called;
      expect(stubs.classify).not.to.have.been.called;
      expect(stubs.publish).not.to.have.been.called;
      expect(stubs.logSuperseded).not.to.have.been.called;
    });

    it('throws HTTP409 before any writes when pending rows share a reconciliation key', async () => {
      const stubs = stubHappyPath();
      stubs.duplicateCount.resolves(2);
      const service = new SubmissionFeatureReconciliationService(
        getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 1)) })
      );

      try {
        await service.reconcileAndActivateSubmissionUpload(UPLOAD_ID);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTP409).message).to.equal(
          'Submission upload contains duplicate feature source ids and cannot be activated'
        );
      }

      expect(stubs.deleteRecords).not.to.have.been.called;
      expect(stubs.classify).not.to.have.been.called;
      expect(stubs.endSuperseded).not.to.have.been.called;
      expect(stubs.publish).not.to.have.been.called;
      expect(stubs.logSuperseded).not.to.have.been.called;
      expect(stubs.closure).not.to.have.been.called;
    });
  });
});
