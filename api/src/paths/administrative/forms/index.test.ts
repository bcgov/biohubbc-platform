import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { FormVersionLayout } from '../../../models/form';
import { FormService } from '../../../services/form-service';
import { createForm, getForms } from './index';

chai.use(sinonChai);

const mockLayout = {
  form: { form_id: 1 },
  form_version: { form_version_id: 2 },
  sections: []
} as unknown as FormVersionLayout;

describe('paths/administrative/forms', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getForms', () => {
    it('lists forms by name ascending by default', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const result = { forms: [], pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1 } };
      const getFormsStub = sinon.stub(FormService.prototype, 'getForms').resolves(result);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { page: '1', limit: '10', keyword: 'cari' };

      await getForms()(mockReq, mockRes, mockNext);

      expect(getFormsStub).to.have.been.calledOnceWith(
        { keyword: 'cari' },
        sinon.match({ page: 1, limit: 10, sort: 'name', order: 'asc' })
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(result);
    });

    it('rolls back and re-throws a failure', async () => {
      const rollback = sinon.stub().resolves();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
      sinon.stub(FormService.prototype, 'getForms').rejects(new Error('test error'));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await getForms()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('test error');
        expect(rollback).to.have.been.calledOnce;
      }
    });
  });

  describe('createForm', () => {
    it('creates a form and returns 201', async () => {
      const commit = sinon.stub().resolves();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ commit }));
      const createStub = sinon.stub(FormService.prototype, 'createForm').resolves(mockLayout);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        slug: 'caribou',
        contributorId: 3,
        name: 'Caribou',
        description: null,
        isPublic: true,
        sections: []
      };

      await createForm()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith(mockReq.body);
      expect(commit).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(mockLayout);
    });

    it('rolls back and re-throws a failure', async () => {
      const rollback = sinon.stub().resolves();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
      sinon.stub(FormService.prototype, 'createForm').rejects(new Error('test error'));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await createForm()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('test error');
        expect(rollback).to.have.been.calledOnce;
      }
    });
  });
});
