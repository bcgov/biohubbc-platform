import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getSubmissionUploadBlueprint } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import * as db from '../../../../../../../database/db';
import { Blueprint } from '../../../../../../../models/blueprint';
import { authorizationDependencies } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

const submissionUploadId = '11111111-1111-4111-8111-111111111111';
const blueprint: Blueprint = {
  blueprint_id: 4,
  name: 'Wildlife',
  version_number: 2,
  description: null,
  is_default: false,
  parent_blueprint_id: 1,
  record_effective_date: '2026-09-01',
  record_end_date: null
};

describe('submission upload blueprint endpoint', () => {
  afterEach(() => sinon.restore());

  describe('getSubmissionUploadBlueprint', () => {
    it('requires administrator authorization before exposing the upload blueprint', async () => {
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

    it('returns the scoped upload blueprint and commits and releases its connection', async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const commit = sinon.stub(connection, 'commit').resolves();
      const release = sinon.stub(connection, 'release');
      const operation = sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBlueprint')
        .resolves(blueprint);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7', submissionUploadId };
      await getSubmissionUploadBlueprint()(mockReq, mockRes, () => {});
      expect(operation).to.have.been.calledOnceWithExactly({ submissionId: 7, submissionUploadId });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.deep.equal(blueprint);
      expect(commit).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  });
});
