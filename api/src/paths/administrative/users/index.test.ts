import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { getAvailableUsers } from './index';

chai.use(sinonChai);

describe('getAvailableUsers', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = getAvailableUsers();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
    }
  });

  it('should return 200 with available users', async () => {
    const mockUsers = [
      { system_user_id: 1, user_identifier: 'alice', display_name: 'Alice', email: 'alice@example.com' },
      { system_user_id: 2, user_identifier: 'bob', display_name: 'Bob', email: 'bob@example.com' }
    ];

    const mockDBConnection = getMockDBConnection({ knex: async () => ({ rows: mockUsers } as any) });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = getAvailableUsers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ users: mockUsers });
  });

  it('should return empty array when no users available', async () => {
    const mockDBConnection = getMockDBConnection({ knex: async () => ({ rows: [] } as any) });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = getAvailableUsers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ users: [] });
  });

  it('should return 200 with users matching search parameter', async () => {
    const mockUsers = [{ system_user_id: 1, user_identifier: 'alice' }];

    const mockDBConnection = getMockDBConnection({ knex: async () => ({ rows: mockUsers } as any) });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: 'ali' };

    const requestHandler = getAvailableUsers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ users: mockUsers });
  });

  it('should handle empty search parameter', async () => {
    const mockUsers = [
      { system_user_id: 1, user_identifier: 'alice' },
      { system_user_id: 2, user_identifier: 'bob' }
    ];

    const mockDBConnection = getMockDBConnection({ knex: async () => ({ rows: mockUsers } as any) });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: '' };

    const requestHandler = getAvailableUsers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ users: mockUsers });
  });

  it('should handle whitespace-only search parameter', async () => {
    const mockUsers = [
      { system_user_id: 1, user_identifier: 'alice' },
      { system_user_id: 2, user_identifier: 'bob' }
    ];

    const mockDBConnection = getMockDBConnection({ knex: async () => ({ rows: mockUsers } as any) });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { keyword: '   ' };

    const requestHandler = getAvailableUsers();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ users: mockUsers });
  });
});
