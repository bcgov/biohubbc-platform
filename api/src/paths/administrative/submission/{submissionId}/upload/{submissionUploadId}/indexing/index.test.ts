import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { POST, reindexSubmissionUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import * as db from '../../../../../../../database/db';
import { HTTP409 } from '../../../../../../../errors/http-error';
import { authorizationDependencies } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

const submissionUploadId = '11111111-1111-4111-8111-111111111111';

describe('submission upload indexing endpoint', () => {
  afterEach(() => sinon.restore());

  describe('reindexSubmissionUpload', () => {
    it('requires system administrator authorization before re-indexing', async () => {
      const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      const next = sinon.stub();

      try {
        await (POST[0] as RequestHandler)(mockReq, mockRes, next);
        expect.fail('Expected authorization rejection');
      } catch (error) {
        expect((error as Error).message).to.equal('Access Denied');
      }

      expect(authorize).to.have.been.calledOnce;
      expect(mockReq.authorization_scheme).to.deep.equal({
        and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
      });
      expect(next).not.to.have.been.called;
    });

    it('queues the re-index with the requested blueprint, responds 202 and commits', async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const commit = sinon.stub(connection, 'commit').resolves();
      const release = sinon.stub(connection, 'release');
      const operation = sinon.stub(SubmissionUploadService.prototype, 'reindexSubmissionUpload').resolves();
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7', submissionUploadId };
      mockReq.body = { blueprintId: 4 };

      await reindexSubmissionUpload()(mockReq, mockRes, () => {});

      expect(operation).to.have.been.calledOnceWithExactly({ submissionId: 7, submissionUploadId }, 4);
      expect(mockRes.statusValue).to.equal(202);
      expect(commit).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });

    it('rolls back and rethrows when the upload cannot be re-indexed', async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const commit = sinon.stub(connection, 'commit').resolves();
      const rollback = sinon.stub(connection, 'rollback').resolves();
      const release = sinon.stub(connection, 'release');
      const error = new HTTP409('Submission upload cannot be re-indexed after it was approved');
      sinon.stub(SubmissionUploadService.prototype, 'reindexSubmissionUpload').rejects(error);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7', submissionUploadId };
      mockReq.body = { blueprintId: 4 };

      try {
        await reindexSubmissionUpload()(mockReq, mockRes, () => {});
        expect.fail('Expected HTTP409');
      } catch (actualError) {
        expect(actualError).to.equal(error);
      }

      expect(commit).not.to.have.been.called;
      expect(rollback).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  });
});
