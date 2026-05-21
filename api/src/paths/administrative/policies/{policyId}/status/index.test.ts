import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { Policy } from '../../../../../models/policy';
import { PolicyService } from '../../../../../services/access-policy/policy-service';
import { patchPolicyStatus } from './index';

chai.use(sinonChai);

describe('paths/administrative/policies/{policyId}/status', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH status delegates to updatePolicy with status payload', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const updatedPolicy: Policy = {
      policy_id: '11111111-1111-1111-1111-111111111111',
      name: 'Policy A',
      description: 'desc',
      status: 'reviewed'
    };

    const updateStub = sinon.stub(PolicyService.prototype, 'updatePolicy').resolves(updatedPolicy);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { policyId: updatedPolicy.policy_id };
    mockReq.body = { status: 'reviewed' };

    await patchPolicyStatus()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(updatedPolicy.policy_id, { status: 'reviewed' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedPolicy);
  });
});
