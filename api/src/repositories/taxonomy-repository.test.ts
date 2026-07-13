import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { TaxonRecord } from '../models/taxon';
import { TaxonomyRepository } from './taxonomy-repository';

chai.use(sinonChai);

describe('TaxonomyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getTaxonByTsnIds', () => {
    it('returns empty without querying when no TSNs are provided', async () => {
      const knexStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      const response = await taxonomyRepository.getTaxonByTsnIds([]);

      expect(response).to.eql([]);
      expect(knexStub).to.not.have.been.called;
    });

    it('should return array of system constants', async () => {
      const TaxonRecord: TaxonRecord = {
        taxon_id: 1,
        itis_tsn: 1,
        parent_itis_tsn: null,
        parent_taxon_id: null,
        bc_taxon_code: 'string',
        itis_scientific_name: 'string',
        rank: 'species',
        common_name: 'string',
        itis_data: {},
        itis_update_date: '2020-01-01'
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [TaxonRecord] as unknown as TaxonRecord[]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      const response = await taxonomyRepository.getTaxonByTsnIds([1]);

      expect(response).to.be.eql([TaxonRecord]);
    });
  });

  describe('insertTaxonRecords', () => {
    it('returns inserted records for the provided bulk insert payload', async () => {
      const taxonRecord1: TaxonRecord = {
        taxon_id: 1,
        itis_tsn: 1,
        parent_itis_tsn: null,
        parent_taxon_id: null,
        bc_taxon_code: 'string',
        itis_scientific_name: 'string',
        rank: 'species',
        common_name: 'string',
        itis_data: {},
        itis_update_date: '2020-01-01'
      };
      const taxonRecord2 = { ...taxonRecord1, taxon_id: 2, itis_tsn: 2 };

      const mockQueryResponse = {
        rowCount: 2,
        rows: [taxonRecord1, taxonRecord2]
      } as unknown as Promise<QueryResult<any>>;

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      const response = await taxonomyRepository.insertTaxonRecords([
        {
          itis_tsn: 1,
          itis_scientific_name: 'string',
          rank: 'species',
          common_name: 'string',
          itis_data: {},
          itis_update_date: '2020-01-01'
        },
        {
          itis_tsn: 2,
          itis_scientific_name: 'string',
          rank: 'species',
          common_name: 'string',
          itis_data: {},
          itis_update_date: '2020-01-01'
        }
      ]);

      expect(sqlStub).to.have.been.calledOnce;
      expect(response).to.eql([taxonRecord1, taxonRecord2]);
    });
  });

  describe('patchTaxonRanks', () => {
    it('does nothing when no records are provided', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      await taxonomyRepository.patchTaxonRanks([]);

      expect(sqlStub).to.not.have.been.called;
    });

    it('patches rank only for existing taxon records', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      await taxonomyRepository.patchTaxonRanks([
        {
          itis_tsn: 1,
          rank: 'species'
        }
      ]);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('UPDATE taxon');
      expect(sqlText).to.include('SET rank = input_rows.rank');
      expect(sqlText).to.include('taxon.itis_tsn = input_rows.itis_tsn');
      expect(sqlText).to.not.include('itis_scientific_name =');
      expect(sqlText).to.not.include('itis_tsn = input_rows.itis_tsn,');
    });
  });

  describe('updateTaxonParentLinks', () => {
    it('does nothing when no pairs are provided', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      await taxonomyRepository.updateTaxonParentLinks([]);

      expect(sqlStub).to.not.have.been.called;
    });

    it('sets parent_itis_tsn and parent_taxon_id for the provided pairs', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      await taxonomyRepository.updateTaxonParentLinks([
        { itis_tsn: 180541, parent_itis_tsn: 180540 },
        { itis_tsn: 180542, parent_itis_tsn: 180541 }
      ]);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
