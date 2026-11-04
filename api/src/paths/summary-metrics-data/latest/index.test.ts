import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { dbDependencies } from '../../../database/db';
import { SummaryMetricDataService } from '../../../services/summary-metric-data-service';
import { GET, getLatestSummaryMetricsData } from './index';

describe('paths/summary-metrics-data/latest', () => {
  afterEach(() => sinon.restore());

  for (const authenticated of [false, true]) {
    it(`returns public metrics with the ${authenticated ? 'authenticated' : 'anonymous'} connection`, async () => {
      const connection = getMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
      const anonymous = sinon.stub(dbDependencies, 'getAPIUserDBConnection').returns(connection);
      const user = sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      if (authenticated) {
        mockReq.keycloak_token = { sub: 'test-user' };
      }
      sinon.stub(SummaryMetricDataService.prototype, 'getLatestSummaryMetricsData').resolves([]);
      await getLatestSummaryMetricsData()(mockReq, mockRes, mockNext);
      expect(GET.apiDoc?.security).to.deep.equal([{ OptionalBearer: [] }]);
      expect(user.called).to.equal(authenticated);
      expect(anonymous.called).to.equal(!authenticated);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.deep.equal({ summary_metrics_data: [] });
      sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
    });
  }

  it('rolls back and releases if the public query fails', async () => {
    const connection = getMockDBConnection({
      rollback: sinon.stub().resolves(),
      release: sinon.stub(),
      commit: sinon.stub().resolves()
    });
    sinon.stub(dbDependencies, 'getAPIUserDBConnection').returns(connection);
    const failure = new Error('query failed');
    sinon.stub(SummaryMetricDataService.prototype, 'getLatestSummaryMetricsData').rejects(failure);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    let caught: unknown;
    try {
      await getLatestSummaryMetricsData()(mockReq, mockRes, mockNext);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(failure);
    sinon.assert.calledOnce(connection.rollback as sinon.SinonStub);
    sinon.assert.calledOnce(connection.release as sinon.SinonStub);
    sinon.assert.notCalled(connection.commit as sinon.SinonStub);
  });
});
