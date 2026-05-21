import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { AccessKeyView } from '../../models/access-key';
import { AccessKeyService } from '../../services/access-key-service';
import { createAccessKey, listAccessKeys } from './index';

chai.use(sinonChai);

const makeAccessKeyView = (overrides: Partial<AccessKeyView> = {}): AccessKeyView => ({
  access_key_id: 'aabbccdd-0000-0000-0000-000000000001',
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

  describe('GET listAccessKeys', () => {
    it('should return 200 with an array of access key views', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      const keys = [makeAccessKeyView()];
      sinon.stub(AccessKeyService.prototype, 'listAccessKeys').resolves(keys);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';

      await listAccessKeys()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(keys);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'listAccessKeys').rejects(new Error('db error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';

      try {
        await listAccessKeys()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('db error');
      }
    });
  });

  describe('POST createAccessKey', () => {
    it('should return 201 with the created access key and plaintext key', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      const view = makeAccessKeyView();
      const plaintextKey = 'biohub_AbCdEfGh_supersecretvalue';
      sinon
        .stub(AccessKeyService.prototype, 'createAccessKey')
        .resolves({ access_key: view, plaintext_key: plaintextKey });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.body = { name: 'My test key' };

      await createAccessKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql({ access_key: view, plaintext_key: plaintextKey });
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'createAccessKey').rejects(new Error('insert failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.body = { name: 'Key' };

      try {
        await createAccessKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('insert failed');
      }
    });
  });
});
