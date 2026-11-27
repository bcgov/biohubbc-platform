import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { SummaryMetricDataService } from '../../../services/summary-metric-data-service';
import { createSummaryMetricData, GET, getSummaryMetricsData, POST } from './index';
import {
  DELETE,
  deleteSummaryMetricData,
  getSummaryMetricData,
  GET as itemGET,
  PUT,
  updateSummaryMetricData
} from './{summaryMetricsDataId}';

const record = {
  summary_metrics_data_id: '11',
  summary_metric_id: 7,
  run_id: '11111111-1111-4111-8111-111111111111',
  calculated_at: '2026-11-04T00:00:00Z',
  value: 123,
  record_effective_date: '2026-11-04T00:00:00Z',
  record_end_date: null,
  create_date: '2026-11-04T00:00:00Z'
};

describe('paths/administrative/summary-metrics-data', () => {
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
    const list = sinon.stub(SummaryMetricDataService.prototype, 'getSummaryMetricsData').resolves([record]);
    const count = sinon.stub(SummaryMetricDataService.prototype, 'getSummaryMetricsDataCount').resolves(11);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { summary_metric_id: '7', run_id: '11111111-1111-4111-8111-111111111111', page: '2', limit: '10' };
    await getSummaryMetricsData()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(
      list,
      { summary_metric_id: 7, run_id: '11111111-1111-4111-8111-111111111111' },
      { page: 2, limit: 10, sort: undefined, order: undefined }
    );
    sinon.assert.calledOnceWithExactly(count, { summary_metric_id: 7, run_id: '11111111-1111-4111-8111-111111111111' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal({
      summary_metrics_data: [record],
      pagination: { total: 11, per_page: 10, current_page: 2, last_page: 2, sort: undefined, order: undefined }
    });
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
    sinon.assert.calledOnce(connection.release as sinon.SinonStub);
  });

  it('creates a record with status 201', async () => {
    const connection = mockConnection();
    const create = sinon.stub(SummaryMetricDataService.prototype, 'createSummaryMetricData').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      summary_metric_id: 7,
      run_id: '11111111-1111-4111-8111-111111111111',
      calculated_at: '2026-11-04T00:00:00Z',
      value: 123
    };
    await createSummaryMetricData()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(create, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.deep.equal(record);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  it('reads one record by its route identifier', async () => {
    mockConnection();
    const get = sinon.stub(SummaryMetricDataService.prototype, 'getSummaryMetricData').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricsDataId: '11' };
    await getSummaryMetricData()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(get, '11');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal(record);
  });

  it('updates only the supplied editable fields', async () => {
    mockConnection();
    const update = sinon.stub(SummaryMetricDataService.prototype, 'updateSummaryMetricData').resolves(record);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricsDataId: '11' };
    mockReq.body = { value: 124 };
    await updateSummaryMetricData()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(update, '11', mockReq.body);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('soft-deletes through the service and returns 204', async () => {
    const connection = mockConnection();
    const remove = sinon.stub(SummaryMetricDataService.prototype, 'deleteSummaryMetricData').resolves();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { summaryMetricsDataId: '11' };
    await deleteSummaryMetricData()(mockReq, mockRes, mockNext);
    sinon.assert.calledOnceWithExactly(remove, '11');
    expect(mockRes.statusValue).to.equal(204);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  for (const [method, handler] of [
    ['getSummaryMetricsData', getSummaryMetricsData],
    ['createSummaryMetricData', createSummaryMetricData],
    ['getSummaryMetricData', getSummaryMetricData],
    ['updateSummaryMetricData', updateSummaryMetricData],
    ['deleteSummaryMetricData', deleteSummaryMetricData]
  ] as const) {
    it(method + ' rolls back and releases on service failure', async () => {
      const connection = mockConnection();
      const failure = new Error('service failed');
      sinon.stub(SummaryMetricDataService.prototype, method).rejects(failure);
      if (method === 'getSummaryMetricsData') {
        sinon.stub(SummaryMetricDataService.prototype, 'getSummaryMetricsDataCount').resolves(0);
      }
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { summaryMetricsDataId: '11' };
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
