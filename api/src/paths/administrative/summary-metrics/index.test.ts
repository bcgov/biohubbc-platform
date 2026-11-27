import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { SummaryMetricService } from '../../../services/summary-metric-service';
import { createSummaryMetric, GET, getSummaryMetrics, POST } from './index';
import {
  DELETE,
  deleteSummaryMetric,
  getSummaryMetric,
  GET as itemGET,
  PUT,
  updateSummaryMetric
} from './{summaryMetricId}';

const record = {
  summary_metric_id: 7,
  key: 'record_count',
  name: 'Records',
  description: 'Published records',
  record_effective_date: '2026-11-04T00:00:00Z',
  record_end_date: null,
  create_date: '2026-11-04T00:00:00Z'
};

describe('paths/administrative/summary-metrics', () => {
  afterEach(() => sinon.restore());
  const operations = { GET, POST, itemGET, PUT, DELETE };
  Object.entries(operations).forEach(([name, operation]) => {
    it(name + ' requires the system administrator role', async () => {
      const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      try {
        await (operation[0] as RequestHandler)(mockReq, mockRes, mockNext);
        expect.fail('Expected forbidden');
      } catch (error) {
        expect(ensureHTTPError(error).status).to.equal(403);
      }
      expect(authorize.firstCall.args[0].authorization_scheme).to.deep.equal({
        and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
      });
      sinon.assert.notCalled(mockNext);
      expect(operation.apiDoc?.security).to.deep.equal([{ Bearer: [] }]);
    });
  });

  function mockConnection() {
    const connection = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    return connection;
  }

  it('lists records with filters, total count, and standard pagination', async () => {
    const connection = mockConnection();
    const list = sinon.stub(SummaryMetricService.prototype, 'getSummaryMetrics').resolves([record]);
    const count = sinon.stub(SummaryMetricService.prototype, 'getSummaryMetricsCount').resolves(11);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { search: 'record', page: '2', limit: '10' };
    await getSummaryMetrics()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(
      list,
      { search: 'record' },
      { page: 2, limit: 10, sort: undefined, order: undefined }
    );
    sinon.assert.calledOnceWithExactly(count, { search: 'record' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal({
      summary_metrics: [record],
      pagination: { total: 11, per_page: 10, current_page: 2, last_page: 2, sort: undefined, order: undefined }
    });
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
    sinon.assert.calledOnce(connection.release as sinon.SinonStub);
  });

  it('creates a record with status 201', async () => {
    const connection = mockConnection();
    const create = sinon.stub(SummaryMetricService.prototype, 'createSummaryMetric').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { key: 'record_count', name: 'Records', description: 'Published records' };
    await createSummaryMetric()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(create, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.deep.equal(record);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  it('reads one record by its route identifier', async () => {
    mockConnection();
    const get = sinon.stub(SummaryMetricService.prototype, 'getSummaryMetric').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricId: '7' };
    await getSummaryMetric()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(get, 7);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal(record);
  });

  it('updates only the supplied editable fields', async () => {
    mockConnection();
    const update = sinon.stub(SummaryMetricService.prototype, 'updateSummaryMetric').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricId: '7' };
    mockReq.body = { name: 'Records', description: 'Published records' };
    await updateSummaryMetric()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(update, 7, mockReq.body);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('soft-deletes through the service and returns 204', async () => {
    const connection = mockConnection();
    const remove = sinon.stub(SummaryMetricService.prototype, 'deleteSummaryMetric').resolves();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricId: '7' };
    await deleteSummaryMetric()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(remove, 7);
    expect(mockRes.statusValue).to.equal(204);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  for (const [method, handler] of [
    ['getSummaryMetrics', getSummaryMetrics],
    ['createSummaryMetric', createSummaryMetric],
    ['getSummaryMetric', getSummaryMetric],
    ['updateSummaryMetric', updateSummaryMetric],
    ['deleteSummaryMetric', deleteSummaryMetric]
  ] as const) {
    it(method + ' rolls back and releases on service failure', async () => {
      const connection = mockConnection();
      const failure = new Error('service failed');
      sinon.stub(SummaryMetricService.prototype, method).rejects(failure);
      if (method === 'getSummaryMetrics') {
        sinon.stub(SummaryMetricService.prototype, 'getSummaryMetricsCount').resolves(0);
      }
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { summaryMetricId: '7' };
      let caught: unknown;
      try {
        await handler()(mockReq, mockRes, mockNext);
      } catch (error) {
        caught = error;
      }
      expect(caught).to.equal(failure);
      sinon.assert.calledOnce(connection.rollback as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
      sinon.assert.notCalled(connection.commit as sinon.SinonStub);
    });
  }
});
