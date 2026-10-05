import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { SubmissionUploadReconciliationService } from '../../../../../../../services/reconciliation/submission-upload-reconciliation-service';

chai.use(sinonChai);

describe('getSubmissionUploadReconciliationCounts', () => {
  afterEach(() => sinon.restore());

  it('returns immutable private reconciliation counts', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'release').resolves();

    const counts = { new: 4, modified: 2, unmodified: 7 };
    const getCounts = sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'getSubmissionFeatureReconciliationCounts')
      .resolves(counts);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111'
    };

    await index.getSubmissionUploadReconciliationCounts()(mockReq, mockRes, () => {});

    expect(getCounts).to.have.been.calledWith(16, mockReq.params.submissionUploadId);
    expect(mockRes.setHeader).to.have.been.calledWith('Cache-Control', 'private, max-age=31536000, immutable');
    expect(mockRes.setHeader).to.have.been.calledWith('Vary', 'Authorization');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(counts);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
