import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getAdminSubmissionList } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import * as db from '../../../database/db';
import { HTTP403 } from '../../../errors/http-error';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';

chai.use(sinonChai);

describe('administrative submission list', () => {
  afterEach(() => sinon.restore());

  it('requires system or data administrator authorization', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    await (GET[0] as RequestHandler)(mockReq, mockRes, mockNext);
    expect(mockReq.authorization_scheme).to.eql({
      and: [
        { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }
      ]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('rejects unauthorized requests before reaching the list handler', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    let caught: unknown;
    try {
      await (GET[0] as RequestHandler)(mockReq, mockRes, mockNext);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(HTTP403);
    expect(mockNext).not.to.have.been.called;
  });

  it('bounds page sizes and restricts sort columns in transport validation', () => {
    const parameters = GET.apiDoc?.parameters ?? [];
    const ajv = new Ajv();
    const schemaFor = (name: string) => {
      const parameter = parameters.find((item) => 'name' in item && item.name === name);
      if (!parameter || !('schema' in parameter)) {
        throw new Error(`Missing schema for ${name}`);
      }
      return ajv.compile(parameter.schema as object);
    };
    const limit = schemaFor('limit');
    expect(limit(0)).to.equal(false);
    expect(limit(201)).to.equal(false);
    expect(limit(25)).to.equal(true);
    expect(schemaFor('page')(0)).to.equal(false);
    const sort = schemaFor('sort');
    expect(sort('name')).to.equal(true);
    expect(sort('contributor_name')).to.equal(true);
    expect(sort('submitted_timestamp')).to.equal(true);
    expect(sort('publish_timestamp')).to.equal(true);
    expect(sort('record_end_date')).to.equal(false);
  });

  it('returns the requested page matching the search and commits before releasing', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const response = { submissions: [], pagination: { total: 0, per_page: 10, current_page: 2, last_page: 1 } };
    const list = sinon.stub(SubmissionService.prototype, 'getAdminSubmissionList').resolves(response);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { search: 'moose', page: '2', limit: '10', sort: 'name', order: 'asc' };
    await getAdminSubmissionList()(mockReq, mockRes, mockNext);
    expect(list).to.have.been.calledOnceWithExactly(
      { keyword: 'moose' },
      { page: 2, limit: 10, sort: 'name', order: 'asc' }
    );
    expect(mockRes.jsonValue).to.eql(response);
    expect(mockRes.statusValue).to.equal(200);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rolls back and releases the connection when loading fails', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const failure = new Error('Database unavailable');
    sinon.stub(SubmissionService.prototype, 'getAdminSubmissionList').rejects(failure);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    let caught: unknown;
    try {
      await getAdminSubmissionList()(mockReq, mockRes, mockNext);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(failure);
    expect(connection.commit).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
