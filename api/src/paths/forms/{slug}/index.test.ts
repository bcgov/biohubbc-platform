import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { FormVersionLayout } from '../../../models/form';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { FormService } from '../../../services/form-service';
import { getFormCodesets } from './codesets/index';
import { getFormCodesetCodes } from './codesets/{contributorCodesetId}/codes/index';
import { findFormBySlug, GET } from './index';

chai.use(sinonChai);

const layout = { sections: [] } as unknown as FormVersionLayout;
const codesetsResult = { codesets: [], pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1 } };

describe('paths/forms/{slug}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('authorizes the form by slug, allowing anonymous requests through to the check', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou' };

    await (GET[0] as RequestHandler)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({ and: [{ discriminator: 'Form', slug: 'caribou' }] });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('reads the published form with the API user connection for an anonymous request', async () => {
    const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
    const userStub = sinon.stub(db.dbDependencies, 'getDBConnection');
    const getStub = sinon.stub(FormService.prototype, 'getPublishedFormBySlug').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou' };

    await findFormBySlug()(mockReq, mockRes, mockNext);

    expect(apiUserStub).to.have.been.calledOnce;
    expect(userStub).not.to.have.been.called;
    expect(getStub).to.have.been.calledOnceWith('caribou');
    expect(mockRes.statusValue).to.equal(200);
  });

  it("reads the published form with the user's connection when authenticated", async () => {
    const userStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    sinon.stub(FormService.prototype, 'getPublishedFormBySlug').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou' };
    mockReq.keycloak_token = { sub: 'user' };

    await findFormBySlug()(mockReq, mockRes, mockNext);

    expect(userStub).to.have.been.calledOnceWith({ sub: 'user' });
  });

  it('rolls back and re-throws a failure', async () => {
    const rollback = sinon.stub().resolves();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection({ rollback }));
    sinon.stub(FormService.prototype, 'getPublishedFormBySlug').rejects(new Error('test error'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou' };

    try {
      await findFormBySlug()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).to.equal('test error');
      expect(rollback).to.have.been.calledOnce;
    }
  });

  it("lists the codesets of the form's contributor", async () => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
    const listStub = sinon.stub(FormService.prototype, 'getFormCodesets').resolves(codesetsResult);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou' };
    mockReq.query = { page: '1', limit: '10' };

    await getFormCodesets()(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledOnceWith('caribou', sinon.match({ page: 1, limit: 10 }));
    expect(mockRes.jsonValue).to.eql(codesetsResult);
  });

  it("lists the codes of one of the form's codesets", async () => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
    const codesResult = { codes: [], pagination: codesetsResult.pagination };
    const listStub = sinon.stub(FormService.prototype, 'getFormCodesetCodes').resolves(codesResult);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { slug: 'caribou', contributorCodesetId: '50' };
    mockReq.query = { page: '1', limit: '10' };

    await getFormCodesetCodes()(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledOnceWith('caribou', 50, sinon.match({ page: 1, limit: 10 }));
    expect(mockRes.jsonValue).to.eql(codesResult);
  });
});
