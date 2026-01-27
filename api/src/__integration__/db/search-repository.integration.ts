// Integration test for SearchRepository — verifies complex SQL (CTEs, JSONB aggregation,
// multi-table joins, ILIKE search) executes correctly against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SearchRepository } from '../../repositories/search-repository';

describe('SearchRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: SearchRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new SearchRepository(connection);
  });

  afterEach(async () => {
    // Rollback — no data persisted
    await connection.rollback();
    connection.release();
  });

  describe('findSubmissions', () => {
    it('should return paginated results with total count', async () => {
      const result = await repo.findSubmissions({ keyword: '' }, { page: 1, limit: 10 });

      expect(result).to.have.property('data').that.is.an('array');
      expect(result).to.have.property('total').that.is.a('number');

      if (result.data.length > 0) {
        expect(result.data[0]).to.have.property('submission_id');
        expect(result.data[0]).to.have.property('name');
      }
    });

    it('should respect pagination limits', async () => {
      const result = await repo.findSubmissions({ keyword: '' }, { page: 1, limit: 1 });

      expect(result.data.length).to.be.at.most(1);
    });

    it('should return empty results for non-matching search', async () => {
      const result = await repo.findSubmissions({ keyword: 'zzz_no_match_xyz_999' }, { page: 1, limit: 10 });

      expect(result.data).to.be.an('array').with.lengthOf(0);
      expect(result.total).to.equal(0);
    });
  });

  describe('findSubmissionSummary', () => {
    it('should return a total count', async () => {
      const result = await repo.findSubmissionSummary({ keyword: '' });

      expect(result).to.have.property('total').that.is.a('number');
      expect(result.total).to.be.gte(0);
    });
  });

  describe('findFeatures', () => {
    it('should return paginated feature results', async () => {
      const result = await repo.findFeatures({ keyword: '' }, { page: 1, limit: 10 });

      expect(result).to.have.property('data').that.is.an('array');
      expect(result).to.have.property('total').that.is.a('number');

      if (result.data.length > 0) {
        expect(result.data[0]).to.have.property('submission_feature_id');
        expect(result.data[0]).to.have.property('feature_type_id');
        expect(result.data[0]).to.have.property('label');
      }
    });
  });

  describe('findFeatureSummary', () => {
    it('should return feature type summaries', async () => {
      const result = await repo.findFeatureSummary({ keyword: '' });

      expect(result).to.be.an('array');
      if (result.length > 0) {
        expect(result[0]).to.have.property('feature_type_name');
        expect(result[0]).to.have.property('total').that.is.a('number');
      }
    });
  });
});
