import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { FormVersionLayout } from '../../../../../models/form';
import { FormService } from '../../../../../services/form-service';
import { createFormVersion } from './index';

chai.use(sinonChai);

describe('paths/administrative/forms/{formId}/versions', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates a draft revision and returns 201', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const layout = { sections: [] } as unknown as FormVersionLayout;
    const createStub = sinon.stub(FormService.prototype, 'createFormVersion').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1' };

    await createFormVersion()(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith(1);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(layout);
  });

  it('rolls back and re-throws a failure', async () => {
    const rollback = sinon.stub().resolves();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
    sinon.stub(FormService.prototype, 'createFormVersion').rejects(new Error('test error'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1' };

    try {
      await createFormVersion()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).to.equal('test error');
      expect(rollback).to.have.been.calledOnce;
    }
  });
});
