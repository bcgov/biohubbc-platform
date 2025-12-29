import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SearchParams } from '../services/search-service.interface';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchRepository } from './search-repository';

chai.use(sinonChai);

describe('SearchRepository', () => {
  let mockDBConnection: any;
  let repo: SearchRepository;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    repo = new SearchRepository(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findFeatures', () => {
    it('returns paginated feature results with data and total', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            result: {
              data: [
                { submission_feature_id: 1, feature_type_id: 1, label: 'Feature1' },
                { submission_feature_id: 2, feature_type_id: 1, label: 'Feature2' }
              ],
              total: 25
            }
          }
        ]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findFeatures(params);

      expect(result).to.eql({
        data: [
          { submission_feature_id: 1, feature_type_id: 1, label: 'Feature1' },
          { submission_feature_id: 2, feature_type_id: 1, label: 'Feature2' }
        ],
        total: 25
      });
    });

    it('returns empty data array and total 0 when no results', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ result: { data: [], total: 0 } }]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findFeatures(params);

      expect(result).to.eql({ data: [], total: 0 });
    });

    it('returns fallback when query returns no rows', async () => {
      mockDBConnection.knex = async () => ({ rowCount: 0, rows: [] });

      const params: SearchParams = { search: 'test' };
      const result = await repo.findFeatures(params);

      expect(result).to.eql({ data: [], total: 0 });
    });
  });

  describe('findSubmissions', () => {
    it('returns paginated submission results with data and total', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            result: {
              data: [
                { submission_id: 10, name: 'Sub1', description: 'Desc1' },
                { submission_id: 11, name: 'Sub2', description: null }
              ],
              total: 15
            }
          }
        ]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findSubmissions(params);

      expect(result).to.eql({
        data: [
          { submission_id: 10, name: 'Sub1', description: 'Desc1' },
          { submission_id: 11, name: 'Sub2', description: null }
        ],
        total: 15
      });
    });

    it('returns empty data array and total 0 when no results', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ result: { data: [], total: 0 } }]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findSubmissions(params);

      expect(result).to.eql({ data: [], total: 0 });
    });

    it('returns fallback when query returns no rows', async () => {
      mockDBConnection.knex = async () => ({ rowCount: 0, rows: [] });

      const params: SearchParams = { search: 'test' };
      const result = await repo.findSubmissions(params);

      expect(result).to.eql({ data: [], total: 0 });
    });
  });

  describe('findTaxon', () => {
    it('returns paginated taxon results with data and total', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            result: {
              data: [
                { taxon_id: 100, scientific_name: 'TaxonA' },
                { taxon_id: 101, scientific_name: 'TaxonB' }
              ],
              total: 8
            }
          }
        ]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findTaxon(params);

      expect(result).to.eql({
        data: [
          { taxon_id: 100, scientific_name: 'TaxonA' },
          { taxon_id: 101, scientific_name: 'TaxonB' }
        ],
        total: 8
      });
    });

    it('returns empty data array and total 0 when no results', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ result: { data: [], total: 0 } }]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findTaxon(params);

      expect(result).to.eql({ data: [], total: 0 });
    });

    it('returns fallback when query returns no rows', async () => {
      mockDBConnection.knex = async () => ({ rowCount: 0, rows: [] });

      const params: SearchParams = { search: 'test' };
      const result = await repo.findTaxon(params);

      expect(result).to.eql({ data: [], total: 0 });
    });
  });

  describe('findFeatureSummary', () => {
    it('returns feature summary rows ordered by count descending', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { feature_type_name: 'Habitat', total: 5 },
          { feature_type_name: 'Species', total: 3 }
        ]
      } as any;

      mockDBConnection.sql = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findFeatureSummary(params);

      expect(result).to.eql([
        { feature_type_name: 'Habitat', total: 5 },
        { feature_type_name: 'Species', total: 3 }
      ]);
    });

    it('returns empty array when no matching features found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any;

      mockDBConnection.sql = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findFeatureSummary(params);

      expect(result).to.eql([]);
    });

    it('returns only priority feature types with counts greater than 0', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ feature_type_name: 'Habitat', total: 10 }]
      } as any;

      mockDBConnection.sql = async () => mockQueryResponse;

      const params: SearchParams = { search: 'forest' };
      const result = await repo.findFeatureSummary(params);

      expect(result).to.be.an('array');
      expect(result.every((f) => f.total > 0)).to.be.true;
      expect(result[0].feature_type_name).to.equal('Habitat');
    });
  });

  describe('findSubmissionSummary', () => {
    it('returns submission summary with total count', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ total: 10 }]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findSubmissionSummary(params);

      expect(result).to.eql({ total: 10 });
    });

    it('returns total 0 when no results', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findSubmissionSummary(params);

      expect(result).to.eql({ total: 0 });
    });
  });

  describe('findTaxonSummary', () => {
    it('returns taxon summary with total count', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ total: 15 }]
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'test' };
      const result = await repo.findTaxonSummary(params);

      expect(result).to.eql({ total: 15 });
    });

    it('returns total 0 when no results', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any;

      mockDBConnection.knex = async () => mockQueryResponse;

      const params: SearchParams = { search: 'nonexistent' };
      const result = await repo.findTaxonSummary(params);

      expect(result).to.eql({ total: 0 });
    });
  });
});
