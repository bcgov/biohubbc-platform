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

  describe('addItisTaxonRecord', () => {
    it('should insert a new taxon record and return it', async () => {
      const tsn = 999999;
      const scientificName = 'Testus integrationus';
      const commonNames = ['Integration Test Species'];
      const itisData = { kingdom: 'Animalia', rank: 'Species' };
      const updateDate = '2024-01-01';

      const result = await repo.addItisTaxonRecord(tsn, scientificName, commonNames, itisData, updateDate);

      expect(result).to.have.property('taxon_id').that.is.a('number');
      expect(result.itis_tsn).to.equal(tsn);
      expect(result.itis_scientific_name).to.equal(scientificName);
      expect(result.common_name).to.equal(commonNames[0]);
      expect(result.itis_data).to.deep.include({ kingdom: 'Animalia' });
    });

    it('should return existing record on conflict (ON CONFLICT DO NOTHING + UNION)', async () => {
      const tsn = 888888;
      const scientificName = 'Duplicatus testus';
      const commonNames = ['Duplicate Test Species'];
      const itisData = { kingdom: 'Plantae' };
      const updateDate = '2024-01-01';

      // First insert
      const first = await repo.addItisTaxonRecord(tsn, scientificName, commonNames, itisData, updateDate);

      // Second insert with same TSN — should return existing record via UNION
      const second = await repo.addItisTaxonRecord(tsn, 'Different Name', ['Other'], {}, updateDate);

      expect(second.taxon_id).to.equal(first.taxon_id);
      expect(second.itis_tsn).to.equal(tsn);
      // Original values preserved (conflict = DO NOTHING)
      expect(second.itis_scientific_name).to.equal(scientificName);
    });
  });

  describe('getTaxonByTsnIds', () => {
    it('should retrieve inserted taxon records by TSN', async () => {
      const tsn = 777777;
      await repo.addItisTaxonRecord(tsn, 'Fetchicus testus', ['Fetch Test'], {}, '2024-01-01');

      const results = await repo.getTaxonByTsnIds([tsn]);

      expect(results).to.be.an('array').with.lengthOf(1);
      expect(results[0].itis_tsn).to.equal(tsn);
    });

    it('should return empty array for non-existent TSN', async () => {
      const results = await repo.getTaxonByTsnIds([0]);

      expect(results).to.be.an('array').with.lengthOf(0);
    });
  });

  describe('deleteTaxonRecord', () => {
    it('should delete an inserted taxon record', async () => {
      const tsn = 666666;
      const inserted = await repo.addItisTaxonRecord(tsn, 'Deleticus testus', ['Delete Test'], {}, '2024-01-01');

      await repo.deleteTaxonRecord(inserted.taxon_id);

      const results = await repo.getTaxonByTsnIds([tsn]);
      expect(results).to.be.an('array').with.lengthOf(0);
    });
  });
});
