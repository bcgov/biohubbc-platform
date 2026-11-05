import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTP400 } from '../errors/http-error';
import { SummaryMetricDataRepository } from '../repositories/summary-metric-data-repository';
import { SummaryMetricDataService } from './summary-metric-data-service';

describe('SummaryMetricDataService', () => {
  afterEach(() => sinon.restore());

  for (const id of ['0', '-1', '1.5', 'abc', '9223372036854775808']) {
    it(`rejects invalid bigint identifier ${id} before querying`, async () => {
      const get = sinon.stub(SummaryMetricDataRepository.prototype, 'getSummaryMetricData');
      let caught: unknown;
      try {
        await new SummaryMetricDataService(getMockDBConnection()).getSummaryMetricData(id);
      } catch (error) {
        caught = error;
      }
      expect(caught).to.be.instanceOf(HTTP400);
      sinon.assert.notCalled(get);
    });
  }

  it('rejects unsupported sort fields before querying', async () => {
    const list = sinon.stub(SummaryMetricDataRepository.prototype, 'getSummaryMetricsData');
    let caught: unknown;
    try {
      await new SummaryMetricDataService(getMockDBConnection()).getSummaryMetricsData(
        {},
        {
          page: 1,
          limit: 25,
          sort: 'value',
          order: 'asc'
        }
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).to.be.instanceOf(HTTP400);
    sinon.assert.notCalled(list);
  });
});
