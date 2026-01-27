import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { SearchPropertyResult } from '../services/property-search-service.interface';
import { getMockDBConnection } from '../__mocks__/db';
import { PropertySearchRepository } from './property-search-repository';

chai.use(sinonChai);

describe('PropertySearchRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('searchStringProperties', () => {
    it('returns string property search results', async () => {
      const mockRows: SearchPropertyResult[] = [
        { feature_property_id: 1, property_name: 'Length', relevancy_score: 1 },
        { feature_property_id: 2, property_name: 'Width', relevancy_score: 1 }
      ];

      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchStringProperties({ keyword: 'len' });

      expect(result).to.eql(mockRows);
    });

    it('returns empty array when no results', async () => {
      const mockRows: SearchPropertyResult[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchStringProperties({ keyword: 'none' });

      expect(result).to.eql([]);
    });
  });

  describe('searchNumberProperties', () => {
    it('returns number property search results', async () => {
      const mockRows: SearchPropertyResult[] = [{ feature_property_id: 3, property_name: 'Depth', relevancy_score: 1 }];

      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchNumberProperties({ keyword: 'dep' });

      expect(result).to.eql(mockRows);
    });

    it('returns empty array when no results', async () => {
      const mockRows: SearchPropertyResult[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchNumberProperties({ keyword: 'none' });

      expect(result).to.eql([]);
    });
  });

  describe('searchStringPropertiesCount', () => {
    it('returns count when rows exist', async () => {
      const mockRows = [{ count: 7 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchStringPropertiesCount({ keyword: 'name' });

      expect(result).to.equal(7);
    });

    it('returns 0 when no rows', async () => {
      const mockRows: { count: number }[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchStringPropertiesCount({ keyword: 'none' });

      expect(result).to.equal(0);
    });
  });

  describe('searchNumberPropertiesCount', () => {
    it('returns count when rows exist', async () => {
      const mockRows = [{ count: 12 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchNumberPropertiesCount({ keyword: 'height' });

      expect(result).to.equal(12);
    });

    it('returns 0 when no rows', async () => {
      const mockRows: { count: number }[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchNumberPropertiesCount({ keyword: 'none' });

      expect(result).to.equal(0);
    });
  });
});
