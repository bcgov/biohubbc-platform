import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { UserService } from '../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as user from './get';

chai.use(sinonChai);

describe('user', () => {
  describe('getUserById', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        userId: '1'
      };

      sinon.stub(UserService.prototype, 'getUserById').throws(new Error('test error'));

      const requestHandler = user.getUserById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('finds user by Id and returns 200 and requestHandler on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        userId: '1'
      };

      sinon.stub(UserService.prototype, 'getUserById').resolves({
        system_user_id: 1,
        user_identity_source_id: 2,
        user_identifier: 'user_identifier',
        user_guid: '123-456-789',
        identity_source: 'idir',
        record_effective_date: '2010-10-10',
        record_end_date: '',
        create_user: 1,
        create_date: '',
        update_user: null,
        update_date: null,
        revision_count: 0,
        role_ids: [],
        role_names: []
      });

      const requestHandler = user.getUserById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql({
        system_user_id: 1,
        user_identity_source_id: 2,
        user_identifier: 'user_identifier',
        user_guid: '123-456-789',
        identity_source: 'idir',
        record_effective_date: '2010-10-10',
        record_end_date: '',
        create_user: 1,
        create_date: '',
        update_user: null,
        update_date: null,
        revision_count: 0,
        role_ids: [],
        role_names: []
      });
    });
  });
});
