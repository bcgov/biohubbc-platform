import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { FormVersionLayout } from '../../../../../../models/form';
import { FormService } from '../../../../../../services/form-service';
import { getFormVersion, updateFormVersion } from './index';
import { publishFormVersion } from './publish/index';

chai.use(sinonChai);

const layout = { sections: [] } as unknown as FormVersionLayout;

describe('paths/administrative/forms/{formId}/versions/{formVersionId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('reads a version layout within its form', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const getStub = sinon.stub(FormService.prototype, 'getFormVersionLayout').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1', formVersionId: '2' };

    await getFormVersion()(mockReq, mockRes, mockNext);

    expect(getStub).to.have.been.calledOnceWith(1, 2);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('replaces a draft layout', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const updateStub = sinon.stub(FormService.prototype, 'updateFormVersion').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1', formVersionId: '2' };
    mockReq.body = { name: 'Caribou', description: null, isPublic: false, sections: [] };

    await updateFormVersion()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith(1, 2, mockReq.body);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('rolls back and re-throws a failed update', async () => {
    const rollback = sinon.stub().resolves();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
    sinon.stub(FormService.prototype, 'updateFormVersion').rejects(new Error('test error'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1', formVersionId: '2' };

    try {
      await updateFormVersion()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).to.equal('test error');
      expect(rollback).to.have.been.calledOnce;
    }
  });

  it('publishes a draft version', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const publishStub = sinon.stub(FormService.prototype, 'publishFormVersion').resolves(layout);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1', formVersionId: '2' };

    await publishFormVersion()(mockReq, mockRes, mockNext);

    expect(publishStub).to.have.been.calledOnceWith(1, 2);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('rolls back and re-throws a failed publish', async () => {
    const rollback = sinon.stub().resolves();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
    sinon.stub(FormService.prototype, 'publishFormVersion').rejects(new Error('test error'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { formId: '1', formVersionId: '2' };

    try {
      await publishFormVersion()(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as Error).message).to.equal('test error');
      expect(rollback).to.have.been.calledOnce;
    }
  });
});
