import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getSubmissionDefaultBlueprint } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import * as db from '../../../../../database/db';
import { Blueprint } from '../../../../../models/blueprint';
import { authorizationDependencies } from '../../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../../services/submission-service';

chai.use(sinonChai);

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

describe('submission blueprint endpoint', () => {
  afterEach(() => sinon.restore());

  describe('getSubmissionDefaultBlueprint', () => {
    it('requires administrator authorization before exposing the default blueprint', async () => {
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

    it('returns the submission default blueprint and commits and releases its connection', async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const commit = sinon.stub(connection, 'commit').resolves();
      const release = sinon.stub(connection, 'release');
      const operation = sinon.stub(SubmissionService.prototype, 'getSubmissionDefaultBlueprint').resolves(blueprint);
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7' };
      await getSubmissionDefaultBlueprint()(mockReq, mockRes, () => {});
      expect(operation).to.have.been.calledOnceWithExactly(7);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.deep.equal(blueprint);
      expect(commit).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  });
});
