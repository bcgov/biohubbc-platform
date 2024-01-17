import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { RegionRepository } from './region-repository';

chai.use(sinonChai);

describe('RegionRepository', () => {
  describe('getRegions', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of region records', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ region_id: 1 }] } as any as Promise<QueryResult<any>>;
      const connection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repo = new RegionRepository(connection);

      const regions = await repo.getRegions();
      expect(regions.length).to.greaterThanOrEqual(1);
    });
  });

  describe('calculateRegionsForASubmission', () => {
    it('should succeed without issue', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ region_id: 1 }] } as any as Promise<QueryResult<any>>;
      const connection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new RegionRepository(connection);

      const regions = await repo.calculateRegionsForASubmission(1);

      expect(regions).to.be.eql([{ region_id: 1 }]);
    });
  });

  describe('insertSubmissionRegions', () => {
    it('should return early with no regions', async () => {
      const connection = getMockDBConnection({
        sql: sinon.mock()
      });

      const repo = new RegionRepository(connection);
      await repo.insertSubmissionRegions(1, []);

      expect(connection.sql).to.not.be.called;
    });
  });
});
