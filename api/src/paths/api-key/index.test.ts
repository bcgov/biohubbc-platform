import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { ApiKeyView } from '../../models/api-key';
import { ApiKeyService } from '../../services/api-key-service';
import { createApiKey, listApiKeys } from './index';

chai.use(sinonChai);

const makeApiKeyView = (overrides: Partial<ApiKeyView> = {}): ApiKeyView => ({
  api_key_id: 'aabbccdd-0000-0000-0000-000000000001',
  system_user_id: 1,
  name: 'My test key',
  key_prefix: 'biohub_AbCdEfGh',
  expires_at: '2027-01-01T00:00:00.000Z',
  revoked_at: null,
  last_used_at: null,
  record_end_date: null,
  create_date: '2026-01-01T00:00:00.000Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  ...overrides
});

describe('paths/api-key/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('GET listApiKeys', () => {
    it('should return 200 with an array of API key views', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      const keys = [makeApiKeyView()];
      sinon.stub(ApiKeyService.prototype, 'listApiKeys').resolves(keys);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';

      await listApiKeys()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(keys);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'listApiKeys').rejects(new Error('db error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';

      try {
        await listApiKeys()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('db error');
      }
    });
  });

  describe('POST createApiKey', () => {
    it('should return 201 with the created API key and plaintext key', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      const view = makeApiKeyView();
      const plaintextKey = 'biohub_AbCdEfGh_supersecretvalue';
      sinon.stub(ApiKeyService.prototype, 'createApiKey').resolves({ api_key: view, plaintext_key: plaintextKey });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.body = { name: 'My test key' };

      await createApiKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql({ api_key: view, plaintext_key: plaintextKey });
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'createApiKey').rejects(new Error('insert failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.body = { name: 'Key' };

      try {
        await createApiKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('insert failed');
      }
    });
  });
});
