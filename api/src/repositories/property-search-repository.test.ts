import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { getMockDBConnection } from '../__mocks__/db';
import { SearchPropertyResult } from '../services/property-search-service.interface';
import { PropertySearchRepository } from './property-search-repository';

chai.use(sinonChai);

describe('PropertySearchRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('searchProperties', () => {
    it('returns feature_property search results', async () => {
      const mockRows: SearchPropertyResult[] = [
        {
          feature_property_id: 1,
          property_name: 'length',
          property_display_name: 'Length',
          feature_property_type: 'number',
          operators: ['Equals', 'GreaterThan', 'Exists'],
          relevancy_score: 1
        }
      ];

      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchProperties({ keyword: 'len' });

      expect(result).to.eql(mockRows);
    });

    it('queries feature_property instead of search value tables', async () => {
      let sql = '';

      const mockDBConnection = getMockDBConnection({
        knex: async (query: any) => {
          sql = query.toString();

          return {
            rowCount: 0,
            rows: []
          } as unknown as QueryResult<any>;
        }
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      await repo.searchProperties({ keyword: 'name' }, { page: 1, limit: 10 });

      expect(sql).to.include('"feature_property" as "fp"');
      expect(sql).to.not.include('search_string');
      expect(sql).to.not.include('search_number');
      expect(sql).to.not.include('feature_type_property');
      expect(sql).to.include('"fp"."name" ilike');
      expect(sql).to.include('"fp"."display_name" ilike');
      expect(sql).to.include('limit 10');
    });

    it('applies feature type filters through feature_type_property', async () => {
      let sql = '';

      const mockDBConnection = getMockDBConnection({
        knex: async (query: any) => {
          sql = query.toString();

          return {
            rowCount: 0,
            rows: []
          } as unknown as QueryResult<any>;
        }
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      await repo.searchProperties({ keyword: 'name', feature_types: ['survey'] });

      expect(sql).to.include('distinct');
      expect(sql).to.include('"feature_type_property" as "ftp"');
      expect(sql).to.include('"feature_type" as "ft"');
      expect(sql).to.include('"ft"."name" in (\'survey\')');
      expect(sql).to.include('"ftp"."record_end_date" is null');
      expect(sql).to.include('"ft"."record_end_date" is null');
    });

    it('returns empty array when no results', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () =>
          ({
            rowCount: 0,
            rows: []
          } as unknown as QueryResult<any>)
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchProperties({ keyword: 'none' });

      expect(result).to.eql([]);
    });
  });

  describe('searchPropertiesCount', () => {
    it('returns count when rows exist', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () =>
          ({
            rowCount: 1,
            rows: [{ count: 7 }]
          } as unknown as QueryResult<any>)
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchPropertiesCount({ keyword: 'name' });

      expect(result).to.equal(7);
    });

    it('counts distinct properties when filtering by feature type', async () => {
      let sql = '';
      const mockDBConnection = getMockDBConnection({
        knex: async (query: any) => {
          sql = query.toString();

          return {
            rowCount: 1,
            rows: [{ count: 1 }]
          } as unknown as QueryResult<any>;
        }
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchPropertiesCount({ feature_types: ['telemetry'] });

      expect(result).to.equal(1);
      expect(sql).to.include('count(DISTINCT fp.feature_property_id)::integer as count');
      expect(sql).to.include('"feature_type_property" as "ftp"');
      expect(sql).to.include('"feature_type" as "ft"');
      expect(sql).to.include('"ft"."name" in (\'telemetry\')');
    });

    it('returns 0 when no rows', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: async () =>
          ({
            rowCount: 0,
            rows: []
          } as unknown as QueryResult<any>)
      });

      const repo = new PropertySearchRepository(mockDBConnection);

      const result = await repo.searchPropertiesCount({ keyword: 'none' });

      expect(result).to.equal(0);
    });
  });
});
