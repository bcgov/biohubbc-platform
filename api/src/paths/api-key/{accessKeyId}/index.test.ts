import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { AccessKeyService } from '../../../services/access-key-service';
import { deleteAccessKey, revokeAccessKey } from './index';

chai.use(sinonChai);

describe('paths/api-key/{accessKeyId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('PATCH revokeAccessKey', () => {
    it('should return 204 when the key is successfully revoked', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'revokeAccessKey').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { accessKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      await revokeAccessKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'revokeAccessKey').rejects(new Error('revoke failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { accessKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      try {
        await revokeAccessKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('revoke failed');
      }
    });
  });

  describe('DELETE deleteAccessKey', () => {
    it('should return 204 when the key is successfully deleted', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'deleteAccessKey').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { accessKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      await deleteAccessKey()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(204);
    });

    it('should throw when the service throws', async () => {
      const dbConnection = getMockDBConnection({ systemUserId: () => 1 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnection);

      sinon.stub(AccessKeyService.prototype, 'deleteAccessKey').rejects(new Error('delete failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { accessKeyId: 'aabbccdd-0000-0000-0000-000000000001' };

      try {
        await deleteAccessKey()(mockReq, mockRes, mockNext);
        expect.fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('delete failed');
      }
    });
  });
});
