import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { ApiKeyService } from '../../../services/api-key-service';
import { deleteApiKey, revokeApiKey } from './index';

chai.use(sinonChai);

describe('paths/api-key/{apiKeyId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('PATCH revokeApiKey', () => {
    it('should return 204 when the key is successfully revoked', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'revokeApiKey').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { apiKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      await revokeApiKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'revokeApiKey').rejects(new Error('revoke failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { apiKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      try {
        await revokeApiKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('revoke failed');
      }
    });
  });

  describe('DELETE deleteApiKey', () => {
    it('should return 204 when the key is successfully deleted', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'deleteApiKey').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { apiKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      await deleteApiKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(ApiKeyService.prototype, 'deleteApiKey').rejects(new Error('delete failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { apiKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      try {
        await deleteApiKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('delete failed');
      }
    });
  });
});
