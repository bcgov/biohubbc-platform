import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { getMockDBConnection } from '../__mocks__/db';
import {
  SearchFeatureResult,
  SearchSubmissionResult,
  SearchSummaryFeature,
  SearchSummarySubmission,
  SearchSummaryTaxon,
  SearchTaxonResult,
  WithCount
} from '../models/search';
import { SearchRepository } from './search-repository';

chai.use(sinonChai);

describe('SearchRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('findFeatures', () => {
    it('returns paginated feature results with data and total', async () => {
      const mockFeatureData: SearchFeatureResult[] = [
        { submission_feature_id: 1, feature_type_id: 1, feature_type_name: 'survey', label: 'Feature1' },
        { submission_feature_id: 2, feature_type_id: 1, feature_type_name: 'survey', label: 'Feature2' }
      ];

      const mockRows: WithCount<typeof SearchFeatureResult>[] = [{ data: mockFeatureData, total: 25 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows.map((r) => ({ result: r }))
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findFeatures({ keyword: 'test' });

      expect(result).to.eql(mockRows[0]);
    });

    it('returns empty data and total 0 when no results', async () => {
      const mockRows: WithCount<typeof SearchFeatureResult>[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findFeatures({ keyword: 'none' });

      expect(result).to.eql({ data: [], total: 0 });
    });
  });

  describe('findSubmissions', () => {
    it('returns paginated submission results with data and total', async () => {
      const mockSubmissionData: SearchSubmissionResult[] = [
        { submission_id: 10, name: 'Sub1', description: 'Desc1' },
        { submission_id: 11, name: 'Sub2', description: null }
      ];

      const mockRows: WithCount<typeof SearchSubmissionResult>[] = [{ data: mockSubmissionData, total: 15 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows.map((r) => ({ result: r }))
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findSubmissions({ keyword: 'test' });

      expect(result).to.eql(mockRows[0]);
    });

    it('returns empty data and total 0 when no results', async () => {
      const mockRows: WithCount<typeof SearchSubmissionResult>[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findSubmissions({ keyword: 'none' });

      expect(result).to.eql({ data: [], total: 0 });
    });
  });

  describe('findTaxon', () => {
    it('returns paginated local taxon results', async () => {
      const mockTaxonData: SearchTaxonResult[] = [
        {
          taxon_id: 100,
          itis_tsn: 180702,
          itis_scientific_name: 'Ovis dalli',
          common_name: "Dall's sheep",
          rank: 'Species',
          relevancy_score: 1
        }
      ];
      const mockRows: WithCount<typeof SearchTaxonResult>[] = [{ data: mockTaxonData, total: 1 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows.map((r) => ({ result: r }))
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = Sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findTaxon({ keyword: 'Ovis dalli' });

      expect(result).to.eql(mockRows[0]);
      expect(knexStub).to.have.been.calledOnce;
      const sql = knexStub.firstCall.args[0].toSQL().sql;
      expect(sql).to.include('"record_end_date" is null');
      expect(sql).to.include('1.0 as relevancy_score');
      expect(sql).to.not.include('case when');
    });
  });

  describe('findFeatureSummary', () => {
    it('returns feature summary rows', async () => {
      const mockRows: SearchSummaryFeature[] = [
        { feature_type_name: 'Habitat', total: 5 },
        { feature_type_name: 'Species', total: 3 }
      ];

      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findFeatureSummary({ keyword: 'test' });

      expect(result).to.eql(mockRows);
    });

    it('returns empty array when no rows', async () => {
      const mockRows: SearchSummaryFeature[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findFeatureSummary({ keyword: 'none' });

      expect(result).to.eql(mockRows);
    });
  });

  describe('findSubmissionSummary', () => {
    it('returns submission summary count', async () => {
      const mockRows: SearchSummarySubmission[] = [{ total: 10 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findSubmissionSummary({ keyword: 'test' });

      expect(result).to.eql(mockRows[0]);
    });

    it('returns total 0 when no rows', async () => {
      const mockRows: SearchSummarySubmission[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findSubmissionSummary({ keyword: 'none' });

      expect(result).to.eql({ total: 0 });
    });
  });

  describe('findTaxonSummary', () => {
    it('returns taxon summary count', async () => {
      const mockRows: SearchSummaryTaxon[] = [{ total: 15 }];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = Sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findTaxonSummary({ keyword: 'test' });

      expect(result).to.eql(mockRows[0]);
      expect(knexStub).to.have.been.calledOnce;
      expect(knexStub.firstCall.args[0].toSQL().sql).to.include('"record_end_date" is null');
    });

    it('returns total 0 when no rows', async () => {
      const mockRows: SearchSummaryTaxon[] = [];

      const mockQueryResponse = {
        rowCount: 0,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new SearchRepository(mockDBConnection);

      const result = await repo.findTaxonSummary({ keyword: 'none' });

      expect(result).to.eql({ total: 0 });
    });
  });
});
