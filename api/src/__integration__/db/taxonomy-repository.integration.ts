// Integration test for TaxonomyRepository — verifies INSERT with CTE, ON CONFLICT,
// and UNION pattern executes correctly against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running)

import { expect } from 'chai';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { TaxonomyRepository } from '../../repositories/taxonomy-repository';

describe('TaxonomyRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: TaxonomyRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new TaxonomyRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  describe('insertTaxonRecords', () => {
    it('should insert a new taxon record and return it', async () => {
      const tsn = 999999;
      const scientificName = 'Testus integrationus';
      const commonName = 'Integration Test Species';
      const itisData = { kingdom: 'Animalia', rank: 'Species' };
      const updateDate = '2024-01-01';

      const [result] = await repo.insertTaxonRecords([
        {
          itis_tsn: tsn,
          itis_scientific_name: scientificName,
          rank: 'Species',
          common_name: commonName,
          itis_data: itisData,
          itis_update_date: updateDate
        }
      ]);

      expect(result).to.have.property('taxon_id').that.is.a('number');
      expect(result.itis_tsn).to.equal(tsn);
      expect(result.itis_scientific_name).to.equal(scientificName);
      expect(result.common_name).to.equal(commonName);
      expect(result.itis_data).to.deep.include({ kingdom: 'Animalia' });
    });

    it('should return existing record on conflict (ON CONFLICT DO NOTHING + UNION)', async () => {
      const tsn = 888888;
      const scientificName = 'Duplicatus testus';
      const commonName = 'Duplicate Test Species';
      const itisData = { kingdom: 'Plantae' };
      const updateDate = '2024-01-01';

      // First insert
      const [first] = await repo.insertTaxonRecords([
        {
          itis_tsn: tsn,
          itis_scientific_name: scientificName,
          rank: 'Species',
          common_name: commonName,
          itis_data: itisData,
          itis_update_date: updateDate
        }
      ]);

      // Second insert with same TSN — should return existing record via UNION
      const [second] = await repo.insertTaxonRecords([
        {
          itis_tsn: tsn,
          itis_scientific_name: 'Different Name',
          rank: 'Species',
          common_name: 'Other',
          itis_data: {},
          itis_update_date: updateDate
        }
      ]);

      expect(second.taxon_id).to.equal(first.taxon_id);
      expect(second.itis_tsn).to.equal(tsn);
      // Original values preserved (conflict = DO NOTHING)
      expect(second.itis_scientific_name).to.equal(scientificName);
    });
  });

  describe('findTaxonByTsnIds', () => {
    it('should retrieve inserted taxon records by TSN', async () => {
      const tsn = 777777;
      await repo.insertTaxonRecords([
        {
          itis_tsn: tsn,
          itis_scientific_name: 'Fetchicus testus',
          rank: 'Species',
          common_name: 'Fetch Test',
          itis_data: {},
          itis_update_date: '2024-01-01'
        }
      ]);

      const results = await repo.findTaxonByTsnIds([tsn]);

      expect(results).to.be.an('array').with.lengthOf(1);
      expect(results[0].itis_tsn).to.equal(tsn);
    });

    it('should return empty array for non-existent TSN', async () => {
      const results = await repo.findTaxonByTsnIds([0]);

      expect(results).to.be.an('array').with.lengthOf(0);
    });
  });

  describe('hierarchy resolution', () => {
    it('sets parent_itis_tsn and resolves parent_taxon_id for a child taxon', async () => {
      const parentTsn = 555551;
      const childTsn = 555552;

      const [parent] = await repo.insertTaxonRecords([
        {
          itis_tsn: parentTsn,
          itis_scientific_name: 'Parentus testus',
          rank: 'Genus',
          common_name: 'Parent',
          itis_data: {},
          itis_update_date: '2024-01-01'
        },
        {
          itis_tsn: childTsn,
          itis_scientific_name: 'Childus testus',
          rank: 'Species',
          common_name: 'Child',
          itis_data: {},
          itis_update_date: '2024-01-01'
        }
      ]);

      await repo.updateTaxonParentLinks([{ itis_tsn: childTsn, parent_itis_tsn: parentTsn }]);

      const [child] = await repo.findTaxonByTsnIds([childTsn]);

      expect(child.parent_itis_tsn).to.equal(parentTsn);
      expect(child.parent_taxon_id).to.equal(parent.taxon_id);
    });
  });
});
