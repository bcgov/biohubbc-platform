import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { FormService } from '../../../../../services/form-service';
import { getFormTeams, updateFormTeams } from './index';

chai.use(sinonChai);

const teams = [{ team_id: '22222222-2222-2222-2222-222222222222', name: 'Field crew' }];

describe('paths/administrative/forms/{formId}/teams', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("lists a form's teams", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const getStub = sinon.stub(FormService.prototype, 'getFormTeams').resolves(teams);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1' };

    await getFormTeams()(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(1);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ teams });
  });

  it("replaces a form's teams", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const updateStub = sinon.stub(FormService.prototype, 'updateFormTeams').resolves(teams);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1' };
    mockReq.body = { teamIds: [teams[0].team_id] };

    await updateFormTeams()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith(1, [teams[0].team_id]);
    expect(mockRes.jsonValue).to.eql({ teams });
  });

  it('rolls back and re-throws a failure', async () => {
    const rollback = sinon.stub().resolves();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
    sinon.stub(FormService.prototype, 'updateFormTeams').rejects(new Error('test error'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1' };
    mockReq.body = { teamIds: [] };

    try {
      await updateFormTeams()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).to.equal('test error');
      expect(rollback).to.have.been.calledOnce;
    }
  });
});
