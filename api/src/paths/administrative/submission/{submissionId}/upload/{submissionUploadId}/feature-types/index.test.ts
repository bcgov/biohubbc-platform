import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, listSubmissionUploadFeatureTypes } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import * as db from '../../../../../../../database/db';
import { ApiNotFoundError } from '../../../../../../../errors/api-error';
import { HTTP403 } from '../../../../../../../errors/http-error';
import { authorizationDependencies } from '../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../services/search-feature-service';

chai.use(sinonChai);

describe('administrative submission upload feature type list', () => {
  const submissionUploadId = '11111111-1111-4111-8111-111111111111';

  afterEach(() => sinon.restore());

  it('requires system or data administrator authorization', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    await (GET[0] as RequestHandler)(mockReq, mockRes, mockNext);
    expect(mockReq.authorization_scheme).to.eql({
      and: [
        { discriminator: 'SystemRole', validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR] }
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

  it('bounds page sizes and restricts sort columns and outcomes in transport validation', () => {
    const parameters = GET.apiDoc?.parameters ?? [];
    const ajv = new Ajv({ formats: { uuid: true } });
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
    expect(schemaFor('submissionId')(-1)).to.equal(false);
    const sort = schemaFor('sort');
    expect(sort('feature_type_name')).to.equal(true);
    expect(sort('count')).to.equal(true);
    expect(sort('arbitrary_column')).to.equal(false);
    const reconciliation = schemaFor('reconciliation');
    expect(reconciliation('new')).to.equal(true);
    expect(reconciliation('deleted')).to.equal(false);
  });

  it('returns the requested page for one outcome and commits before releasing', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const response = {
      feature_types: [{ feature_type_name: 'animal', count: 2 }],
      pagination: { total: 11, per_page: 10, current_page: 2, last_page: 2 }
    };
    const list = sinon.stub(SearchFeatureService.prototype, 'listSubmissionUploadFeatureTypes').resolves(response);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionUploadId };
    mockReq.query = { reconciliation: 'unmodified', page: '2', limit: '10', sort: 'count', order: 'desc' };
    await listSubmissionUploadFeatureTypes()(mockReq, mockRes, mockNext);
    expect(list).to.have.been.calledOnceWithExactly(
      { submissionId: 7, submissionUploadId },
      { reconciliation: 'unmodified' },
      { page: 2, limit: 10, sort: 'count', order: 'desc' }
    );
    expect(mockRes.jsonValue).to.eql(response);
    expect(mockRes.statusValue).to.equal(200);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('lists every outcome when no reconciliation outcome is requested', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const list = sinon.stub(SearchFeatureService.prototype, 'listSubmissionUploadFeatureTypes').resolves({
      feature_types: [],
      pagination: { total: 0, per_page: 25, current_page: 1, last_page: 1 }
    });
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionUploadId };
    await listSubmissionUploadFeatureTypes()(mockReq, mockRes, mockNext);
    expect(list.firstCall.args[1]).to.eql({ reconciliation: null });
  });

  it('rolls back and releases the connection when the upload does not belong to the submission', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const failure = new ApiNotFoundError('Submission upload not found');
    sinon.stub(SearchFeatureService.prototype, 'listSubmissionUploadFeatureTypes').rejects(failure);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionUploadId };
    let caught: unknown;
    try {
      await listSubmissionUploadFeatureTypes()(mockReq, mockRes, mockNext);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(failure);
    expect(connection.commit).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
