import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getAdminSubmissionUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import * as db from '../../../../../../database/db';
import { AdminSubmissionUpload } from '../../../../../../models/submission-upload';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

const submissionUploadId = '11111111-1111-4111-8111-111111111111';
const upload: AdminSubmissionUpload = {
  submission_upload_id: submissionUploadId,
  upload_id: '22222222-2222-4222-8222-222222222222',
  status: 'indexed',
  decision: 'pending',
  ticket_id: '33333333-3333-4333-8333-333333333333',
  comment: null,
  create_date: '2026-10-01T00:00:00.000Z',
  create_user: 1,
  submitted_by_identifier: 'jdoe'
};

describe('submission upload endpoint', () => {
  afterEach(() => sinon.restore());

  describe('getAdminSubmissionUpload', () => {
    it('requires administrator authorization before exposing the upload', async () => {
      const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      const next = sinon.stub();

      try {
        await (GET[0] as RequestHandler)(mockReq, mockRes, next);
        expect.fail('Expected authorization rejection');
      } catch (error) {
        expect((error as Error).message).to.equal('Access Denied');
      }

      expect(authorize).to.have.been.calledOnce;
      expect(mockReq.authorization_scheme).to.deep.equal({
        and: [
          { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }
        ]
      });
      expect(next).not.to.have.been.called;
    });

    it('returns the scoped upload and commits and releases its connection', async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const commit = sinon.stub(connection, 'commit').resolves();
      const release = sinon.stub(connection, 'release');
      const operation = sinon.stub(SubmissionUploadService.prototype, 'getAdminSubmissionUpload').resolves(upload);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7', submissionUploadId };

      await getAdminSubmissionUpload()(mockReq, mockRes, () => {});

      expect(operation).to.have.been.calledOnceWithExactly({ submissionId: 7, submissionUploadId });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.deep.equal(upload);
      expect(commit).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  });
});
