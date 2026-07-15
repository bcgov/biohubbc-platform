import chai, { expect } from 'chai';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  IPromoteSubmissionFeaturesJobData,
  promoteSubmissionFeaturesFailedHandler,
  promoteSubmissionFeaturesJobHandler
} from './promote-submission-features-job';

chai.use(sinonChai);

const JOB_DATA: IPromoteSubmissionFeaturesJobData = { submissionUploadId: 'upload-1' };
const createJob = (): PgBoss.Job<IPromoteSubmissionFeaturesJobData> =>
  ({
    id: 'job-1',
    name: 'promote-submission-features',
    data: JOB_DATA
  } as PgBoss.Job<IPromoteSubmissionFeaturesJobData>);

describe('promote-submission-features-job', () => {
  afterEach(() => sinon.restore());

  function stubConnection() {
    const connection = getMockDBConnection();
    connection.open = sinon.stub().resolves();
    connection.commit = sinon.stub().resolves();
    connection.rollback = sinon.stub().resolves();
    connection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
    return connection;
  }

  function stubUpload(status: 'reconciled' | 'promoting' | 'indexed' = 'reconciled') {
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves({
      submission_upload_id: 'upload-1',
      submission_id: 9,
      upload_id: 'source-upload-1',
      team_id: 'team-1',
      ticket_id: 'ticket-1',
      blueprint_id: 1,
      status
    });
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToPromoting').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToPromoted').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus').resolves();
  }

  it('promotes an upload', async () => {
    stubConnection();
    stubUpload();
    const promote = sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'promoteSubmissionUploadFeatures')
      .resolves(3);
    await promoteSubmissionFeaturesJobHandler([createJob()]);

    expect(promote).to.have.been.calledOnceWith('upload-1');
    expect(SubmissionUploadService.prototype.transitionSubmissionUploadToPromoted).to.have.been.calledOnceWith(
      'upload-1'
    );
  });

  it('skips uploads outside the promotion start states', async () => {
    stubConnection();
    stubUpload('indexed');
    const promote = sinon.stub(SubmissionUploadReconciliationService.prototype, 'promoteSubmissionUploadFeatures');

    await promoteSubmissionFeaturesJobHandler([createJob()]);

    expect(promote).not.to.have.been.called;
  });

  it('marks exhausted promotion work failed from resumable states', async () => {
    stubConnection();
    stubUpload();

    await promoteSubmissionFeaturesFailedHandler([createJob()]);

    expect(SubmissionUploadService.prototype.transitionSubmissionUploadStatus).to.have.been.calledOnceWith(
      'upload-1',
      'failed',
      ['reconciled', 'promoting', 'failed']
    );
  });
});
