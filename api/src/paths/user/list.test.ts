import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SystemUserExtended } from '../../models/system-user';
import { UserService } from '../../services/user-service';
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
      mockReq.query = { page: '1', limit: '10', search: 'identifier' };

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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
          role_names: ['System Admin', 'Project Lead'],
          display_name: null,
          given_name: null,
          family_name: null,
          email: null,
          agency: null,
          notes: null
        }
      ];

      const listStub = sinon.stub(UserService.prototype, 'listSystemUsers').resolves(mockResponse);
      const countStub = sinon.stub(UserService.prototype, 'getSystemUsersCount').resolves(1);

      const requestHandler = users.getUserList();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql({
        users: mockResponse,
        pagination: {
          total: 1,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      });
      expect(listStub).to.have.been.calledOnce;
      expect(countStub).to.have.been.calledOnceWith('identifier');
    });
  });
});
