import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../database/db';
import { TeamPolicy } from '../../../../../models/team-policy';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createTeamPolicies } from './index';

chai.use(sinonChai);

describe('teams/{teamId}/policy', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should create team policies in bulk and return 201 on success', async () => {
    const mockDBConnection = getMockDBConnection();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { teamId: '22222222-2222-2222-2222-222222222222' };
    mockReq.body = {
      policies: ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']
    };

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const mockResponse: TeamPolicy[] = [
      {
        team_policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '33333333-3333-3333-3333-333333333333'
      },
      {
        team_policy_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        team_id: '22222222-2222-2222-2222-222222222222',
        policy_id: '44444444-4444-4444-4444-444444444444'
      }
    ];

    const createStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicies').resolves(mockResponse);

    const requestHandler = createTeamPolicies();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith('22222222-2222-2222-2222-222222222222', [
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444'
    ]);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql({ team_policies: mockResponse });
  });

  it('should default policies to an empty array when omitted', async () => {
    const mockDBConnection = getMockDBConnection();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { teamId: '22222222-2222-2222-2222-222222222222' };
    mockReq.body = {};

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicies').resolves([]);

    const requestHandler = createTeamPolicies();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith('22222222-2222-2222-2222-222222222222', []);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql({ team_policies: [] });
  });
});
