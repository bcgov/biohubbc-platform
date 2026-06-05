import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import { HTTP401 } from '../../errors/http-error';
import { SystemUserExtended } from '../../repositories/user-repository';
import { ApiKeyService } from '../../services/api-key-service';
import { UserService } from '../../services/user-service';
import * as apiKeyAuth from './api-key-authentication';

chai.use(sinonChai);

const makeSystemUser = (overrides: Partial<SystemUserExtended> = {}): SystemUserExtended => ({
  system_user_id: 1,
  user_identity_source_id: 2,
  user_identifier: 'testuser',
  user_guid: 'test-guid-123',
  record_effective_date: '2026-01-01',
  record_end_date: null,
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  display_name: 'Test User',
  given_name: 'Test',
  family_name: 'User',
  email: 'test@example.com',
  agency: null,
  notes: null,
  identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
  role_ids: [1],
  role_names: [SYSTEM_ROLE.MEMBER],
  ...overrides
});

describe('authenticateRequestApiKey', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should throw HTTP401 when X-API-Key header is missing', async () => {
    const dbConnection = getMockDBConnection();
    sinon.stub(apiKeyAuth.apiKeyAuthenticationDependencies, 'getAPIUserDBConnection').returns(dbConnection);

    const { mockReq } = getRequestHandlerMocks();
    mockReq.headers = {};

    try {
      await apiKeyAuth.authenticateRequestApiKey(mockReq);
      expect.fail('Expected to throw');
    } catch (err) {
      expect(err).to.be.instanceOf(HTTP401);
    }
  });

  it('should throw HTTP401 when the API key fails verification', async () => {
    const dbConnection = getMockDBConnection();
    sinon.stub(apiKeyAuth.apiKeyAuthenticationDependencies, 'getAPIUserDBConnection').returns(dbConnection);

    sinon.stub(ApiKeyService.prototype, 'verifyApiKey').rejects(new HTTP401('Access Denied'));

    const { mockReq } = getRequestHandlerMocks();
    mockReq.headers = { 'x-api-key': 'biohub_BadPrefix_badsecretvalue' };

    try {
      await apiKeyAuth.authenticateRequestApiKey(mockReq);
      expect.fail('Expected to throw');
    } catch (err) {
      expect(err).to.be.instanceOf(HTTP401);
    }
  });

  it('should throw HTTP401 when the key owner user is inactive', async () => {
    const dbConnection = getMockDBConnection();
    sinon.stub(apiKeyAuth.apiKeyAuthenticationDependencies, 'getAPIUserDBConnection').returns(dbConnection);

    sinon.stub(ApiKeyService.prototype, 'verifyApiKey').resolves({
      api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
      system_user_id: 1
    });

    sinon
      .stub(UserService.prototype, 'getUserById')
      .resolves(makeSystemUser({ record_end_date: '2025-01-01T00:00:00.000Z' }));

    const { mockReq } = getRequestHandlerMocks();
    mockReq.headers = { 'x-api-key': 'biohub_TestPref_supersecretvalue32byteslong12345' };

    try {
      await apiKeyAuth.authenticateRequestApiKey(mockReq);
      expect.fail('Expected to throw');
    } catch (err) {
      expect(err).to.be.instanceOf(HTTP401);
    }
  });

  it('should populate req.keycloak_token, req.system_user, and call touchLastUsedAt on success', async () => {
    const dbConnection = getMockDBConnection();
    sinon.stub(apiKeyAuth.apiKeyAuthenticationDependencies, 'getAPIUserDBConnection').returns(dbConnection);

    const verifyStub = sinon.stub(ApiKeyService.prototype, 'verifyApiKey').resolves({
      api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
      system_user_id: 1
    });

    const user = makeSystemUser();
    sinon.stub(UserService.prototype, 'getUserById').resolves(user);

    const touchStub = sinon.stub(ApiKeyService.prototype, 'touchLastUsedAt').resolves();

    const { mockReq } = getRequestHandlerMocks();
    mockReq.headers = { 'x-api-key': 'biohub_TestPref_supersecretvalue32byteslong12345' };

    const result = await apiKeyAuth.authenticateRequestApiKey(mockReq);

    expect(result).to.equal(true);
    expect(verifyStub).to.have.been.calledOnce;
    expect(touchStub).to.have.been.calledOnceWith('aabbccdd-0000-0000-0000-000000000001');
    expect(mockReq.system_user).to.eql(user);
    expect((mockReq as any).keycloak_token).to.deep.include({
      preferred_username: `test-guid-123@${SYSTEM_IDENTITY_SOURCE.IDIR.toLowerCase()}`
    });
  });
});
