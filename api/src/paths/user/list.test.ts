import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { SystemUserExtended } from '../../repositories/user-repository';
import { UserService } from '../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as users from './list';

chai.use(sinonChai);

describe('users', () => {
  describe('getUserList', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows on success', async () => {
      const mockDBConnection = getMockDBConnection();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse: SystemUserExtended[] = [
        {
          system_user_id: 1,
          user_identity_source_id: 2,
          user_identifier: 'identifier',
          user_guid: '123-456-789',
          identity_source: 'idir',
          record_effective_date: '',
          record_end_date: '',
          create_user: 1,
          create_date: '',
          update_user: null,
          update_date: null,
          revision_count: 0,
          role_ids: [1, 2],
          role_names: ['System Admin', 'Project Lead']
        }
      ];

      sinon.stub(UserService.prototype, 'listSystemUsers').resolves(mockResponse);

      const requestHandler = users.getUserList();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
