import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TaxonomyRepository, TaxonRecord } from './taxonomy-repository';

chai.use(sinonChai);

describe('TaxonomyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getTaxonByTsnIds', () => {
    it('should return array of system constants', async () => {
      const TaxonRecord = {
        taxon_id: 1,
        itis_tsn: 1,
        bc_taxon_code: 'string',
        itis_scientific_name: 'string',
        common_name: 'string',
        itis_data: {},
        record_effective_date: 'string',
        record_end_date: 'string',
        create_date: 'string',
        create_user: 1,
        update_date: 'string',
        update_user: 1,
        revision_count: 1
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

  describe('addItisTaxonRecord', () => {
    it('should return a new taxon record', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            taxon_id: 1,
            itis_tsn: 1,
            bc_taxon_code: 'string',
            itis_scientific_name: 'string',
            common_name: 'string',
            itis_data: {},
            record_effective_date: 'string',
            record_end_date: 'string',
            create_date: 'string',
            create_user: 1,
            update_date: 'string',
            update_user: 1,
            revision_count: 1
          }
        ]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      const response = await taxonomyRepository.addItisTaxonRecord(1, 'string', ['string'], {}, 'string');

      expect(response).to.be.eql({
        taxon_id: 1,
        itis_tsn: 1,
        bc_taxon_code: 'string',
        itis_scientific_name: 'string',
        common_name: 'string',
        itis_data: {},
        record_effective_date: 'string',
        record_end_date: 'string',
        create_date: 'string',
        create_user: 1,
        update_date: 'string',
        update_user: 1,
        revision_count: 1
      });
    });
  });

  describe('deleteTaxonRecord', () => {
    it('should return a deleted taxon record', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            taxon_id: 1,
            itis_tsn: 1,
            bc_taxon_code: 'string',
            itis_scientific_name: 'string',
            common_name: 'string',
            itis_data: {},
            record_effective_date: 'string',
            record_end_date: 'string',
            create_date: 'string',
            create_user: 1,
            update_date: 'string',
            update_user: 1,
            revision_count: 1
          }
        ]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const taxonomyRepository = new TaxonomyRepository(mockDBConnection);

      const response = await taxonomyRepository.deleteTaxonRecord(1);

      expect(response).to.be.eql(undefined);
    });
  });
});
