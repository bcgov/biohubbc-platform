import Ajv from 'ajv';
import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { dbDependencies } from '../../../database/db';
import { ApiConflictError, ApiExecuteSQLError } from '../../../errors/api-error';
import { ContributorInputSchema } from '../../../openapi/schemas/contributor-administration';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { ContributorService } from '../../../services/contributor-service';
import { GET, insertAdministrativeContributor, listAdministrativeContributors, POST } from './index';
import { GET as contributorGet, DELETE, deleteAdministrativeContributor, PUT } from './{contributorId}/index';

const operations = [GET, POST, contributorGet, PUT, DELETE];

describe('Contributor administrative endpoints', () => {
  afterEach(() => sinon.restore());

  for (const [index, operation] of operations.entries()) {
    it(`protects operation ${index + 1} with System Admin authorization`, async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const handler = (operation as RequestHandler[])[0];
      try {
        await handler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as { status: number }).status).equals(403);
      }
      expect(mockReq.authorization_scheme).eql({
        and: [{ validSystemRoles: ['System Administrator'], discriminator: 'SystemRole' }]
      });
      expect(mockNext.called).is.false;
    });
  }

  it('returns a paginated list through one service entrypoint and commits', async () => {
    const connection = getMockDBConnection();
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.spy(connection, 'commit');
    const release = sinon.spy(connection, 'release');
    const result = {
      contributors: [],
      pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    };
    const list = sinon.stub(ContributorService.prototype, 'listAdministrativeContributors').resolves(result);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'client', active_only: 'true', page: '1', limit: '10' };
    await listAdministrativeContributors()(mockReq, mockRes, mockNext);
    expect(list.firstCall.args[0]).eql({ keyword: 'client', activeOnly: true });
    expect(mockRes.statusValue).equals(200);
    expect(mockRes.jsonValue).eql(result);
    expect(commit.calledOnce).is.true;
    expect(release.calledOnce).is.true;
  });

  it('rolls back and releases before translating concurrent uniqueness errors', async () => {
    const connection = getMockDBConnection();
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    const rollback = sinon.spy(connection, 'rollback');
    const release = sinon.spy(connection, 'release');
    const error = new ApiExecuteSQLError('Failed to execute SQL', [
      new Error('duplicate key value violates unique constraint "contributor_uk"')
    ]);
    sinon.stub(ContributorService.prototype, 'insertAdministrativeContributor').rejects(error);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { clientId: 'client', description: null };
    try {
      await insertAdministrativeContributor()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (caughtError) {
      expect(caughtError).instanceOf(ApiConflictError);
    }
    expect(rollback.calledOnce).is.true;
    expect(release.calledOnce).is.true;
  });

  it('rolls back contributor deletion if ending relationships fails', async () => {
    const connection = getMockDBConnection();
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    const rollback = sinon.spy(connection, 'rollback');
    const commit = sinon.spy(connection, 'commit');
    const release = sinon.spy(connection, 'release');
    sinon.stub(ContributorService.prototype, 'getAdministrativeContributor');
    sinon
      .stub(ContributorService.prototype, 'deleteAdministrativeContributor')
      .rejects(new Error('relationship failure'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { contributorId: '1' };
    try {
      await deleteAdministrativeContributor()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).equals('relationship failure');
    }
    expect(rollback.calledOnce).is.true;
    expect(commit.called).is.false;
    expect(release.calledOnce).is.true;
  });

  it('validates transport input boundaries and camelCase fields', () => {
    const ajv = new Ajv({ strict: false });
    const contributor = ajv.compile(ContributorInputSchema);
    expect(contributor({ clientId: 'SIMS', description: null })).is.true;
    expect(contributor({ clientId: 'biohub-client_123', description: null })).is.true;
    for (const body of [
      { clientId: '', description: null },
      { clientId: 'x'.repeat(101), description: null },
      { client_id: 'SIMS', description: null },
      { clientId: 'SIMS', description: 'x'.repeat(1001) }
    ]) {
      expect(contributor(body)).is.false;
    }
  });
});
