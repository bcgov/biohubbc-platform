import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { PATCH, updateSubmission } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import * as db from '../../../../database/db';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';

chai.use(sinonChai);

describe('updateSubmission endpoint', () => {
  afterEach(() => sinon.restore());

  it('restricts updating a submission to system administrators', async () => {
    const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    const next = sinon.stub();
    try {
      await (PATCH[0] as RequestHandler)(mockReq, mockRes, next);
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

  it('sets the submission default blueprint and commits', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const release = sinon.stub(connection, 'release');
    const operation = sinon.stub(SubmissionService.prototype, 'updateSubmissionDefaultBlueprint').resolves();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7' };
    mockReq.body = { default_blueprint_id: 4 };
    await updateSubmission()(mockReq, mockRes, () => {});
    expect(operation).to.have.been.calledOnceWithExactly(7, 4);
    expect(mockRes.statusValue).to.equal(204);
    expect(commit).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });

  it('rolls back and releases on failure without committing', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const rollback = sinon.stub(connection, 'rollback').resolves();
    const release = sinon.stub(connection, 'release');
    const error = new Error('Update failed');
    sinon.stub(SubmissionService.prototype, 'updateSubmissionDefaultBlueprint').rejects(error);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7' };
    mockReq.body = { default_blueprint_id: 4 };
    try {
      await updateSubmission()(mockReq, mockRes, () => {});
      expect.fail('Expected failure');
    } catch (actual) {
      expect(actual).to.equal(error);
    }
    expect(commit).not.to.have.been.called;
    expect(rollback).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });
});
