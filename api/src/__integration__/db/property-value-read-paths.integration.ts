// Integration test for the indexed-property read paths that surface reference-typed values as structured
// objects: the search result row `properties` JSON (SearchFeatureRepository) and the feature-detail
// properties list (SubmissionFeaturePropertyRepository). Both must emit the same object for the same
// indexed row, and the list path must search and sort on the object's label.
//
// Fixtures write canonical rows straight into the typed property tables against seeded feature types.
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SubmissionFeaturePropertyRepository } from '../../repositories/submission-feature-property-repository';
import {
  addCodeProperty,
  addTaxonProperty,
  createCodesetCode,
  createFeatureTypeProperty,
  createTaxon,
  insertSubmissionFeaturePropertyFeature
} from '../helpers/test-feature-property-helpers';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

// Deterministic token: no seeded value contains it, so label searches can't match pre-existing data.
const TOKEN = 'INTPROPVAL411';

describe('Indexed property value read paths (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let propertyRepository: SubmissionFeaturePropertyRepository;
  let searchRepository: SearchFeatureRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    propertyRepository = new SubmissionFeaturePropertyRepository(connection);
    searchRepository = new SearchFeatureRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Search the anchor feature type without a security context and return the row for one feature.
   * Newest features sort first so the fixture is on the first page regardless of how many seeded
   * features share its type.
   */
  async function findSearchRow(featureTypeName: string, submissionFeatureId: number) {
    const rows = await searchRepository.searchFeaturesByExpressionTree(featureTypeName, undefined, {
      limit: 25,
      sort: 'submission_feature_id',
      order: 'desc'
    });

    const row = rows.find((candidate) => candidate.submission_feature_id === submissionFeatureId);
    expect(row, `search row for feature ${submissionFeatureId}`).to.not.be.undefined;

    return row!;
  }

  /** Read back the TSN the fixture assigned to a taxon row. */
  async function getTaxonTsn(taxonId: number): Promise<number> {
    const result = await connection.sql(SQL`SELECT itis_tsn FROM taxon WHERE taxon_id = ${taxonId};`);

    return result.rows[0].itis_tsn;
  }

  describe('taxon values', () => {
    // A taxon value belongs on a taxon-declared property. `species_observation.taxon_id` reads like
    // one but is declared `number` — 20260820120000 moved it back, storing the public ITIS TSN.
    const featureTypeName = 'habitat_feature';
    const propertyName = 'associated_species';

    it('returns the same structured taxon value from the search row and the properties list', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const taxonId = await createTaxon(connection, `Canis ${TOKEN}`, 'Gray Wolf', null, null, 'Species');
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, taxonId);

      const expected = { taxon_id: taxonId, tsn: await getTaxonTsn(taxonId), rank: 'Species', label: `Canis ${TOKEN}` };

      const rows = await propertyRepository.getSubmissionFeatureProperties(featureId, { page: 1, limit: 25 });
      const taxonRow = rows.find((row) => row.id.startsWith('taxon:'));
      expect(taxonRow).to.not.be.undefined;
      expect(taxonRow?.value).to.deep.equal(expected);

      const searchRow = await findSearchRow(featureTypeName, featureId);
      const searchValue = searchRow.properties[propertyName];
      expect(Array.isArray(searchValue) ? searchValue[0] : searchValue).to.deep.equal(expected);
    });

    it('labels a taxon with the scientific name, and keeps a null rank', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const taxonId = await createTaxon(connection, `Ursus ${TOKEN}`, 'Black Bear');
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, taxonId);

      const rows = await propertyRepository.getSubmissionFeatureProperties(featureId, { page: 1, limit: 25 });
      const taxonRow = rows.find((row) => row.id.startsWith('taxon:'));

      expect(taxonRow?.value).to.include({ taxon_id: taxonId, rank: null, label: `Ursus ${TOKEN}` });
    });

    it('searches the properties list by the taxon label, not by its identifiers', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const taxonId = await createTaxon(connection, `Alces ${TOKEN}`, 'Moose', null, null, 'Species');
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, taxonId);

      const byLabel = await propertyRepository.getSubmissionFeatureProperties(
        featureId,
        { page: 1, limit: 25 },
        { search: `alces ${TOKEN.toLowerCase()}` }
      );
      expect(byLabel.map((row) => row.id.split(':')[0])).to.deep.equal(['taxon']);
      expect(await propertyRepository.getSubmissionFeaturePropertiesCount(featureId, { search: 'alces' })).to.equal(1);

      const byTsn = await propertyRepository.getSubmissionFeatureProperties(
        featureId,
        { page: 1, limit: 25 },
        { search: String(await getTaxonTsn(taxonId)) }
      );
      expect(byTsn).to.be.empty;
    });

    it('omits taxa that have been end-dated, on both read paths', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const taxonId = await createTaxon(connection, `Vulpes ${TOKEN}`, 'Red Fox', null, null, 'Species');
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, taxonId);
      await connection.sql(SQL`
        UPDATE taxon SET record_end_date = now() - interval '1 day' WHERE taxon_id = ${taxonId};
      `);

      const rows = await propertyRepository.getSubmissionFeatureProperties(featureId, { page: 1, limit: 25 });
      expect(rows.filter((row) => row.id.startsWith('taxon:'))).to.be.empty;

      const searchRow = await findSearchRow(featureTypeName, featureId);
      expect(searchRow.properties[propertyName]).to.be.undefined;
    });

    it('sorts the properties list by the taxon label when sorting by value', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const lateTaxonId = await createTaxon(connection, `Zapus ${TOKEN}`, 'Jumping Mouse');
      const earlyTaxonId = await createTaxon(connection, `Alces ${TOKEN}`, 'Moose');
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, lateTaxonId);
      await addTaxonProperty(connection, featureId, featureTypeName, propertyName, earlyTaxonId);

      const ascending = await propertyRepository.getSubmissionFeatureProperties(featureId, {
        page: 1,
        limit: 25,
        sort: 'value',
        order: 'asc'
      });
      const labels = ascending
        .filter((row) => row.id.startsWith('taxon:'))
        .map((row) => (typeof row.value === 'string' ? row.value : row.value.label));

      expect(labels).to.deep.equal([`Alces ${TOKEN}`, `Zapus ${TOKEN}`]);
    });
  });

  describe('code values', () => {
    const featureTypeName = 'survey';
    const propertyName = 'site_select_strategy';

    it('returns the same structured code value from the search row and the properties list', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const codeId = await createCodesetCode(connection, 'random', `Random ${TOKEN}`, null, {
        key: `site_select_strategies_${TOKEN}`,
        label: 'Site Selection Strategies'
      });
      await addCodeProperty(connection, featureId, featureTypeName, propertyName, codeId);

      const expected = {
        codeset_key: `site_select_strategies_${TOKEN}`,
        codeset_label: 'Site Selection Strategies',
        code_key: 'random',
        code_label: `Random ${TOKEN}`,
        label: `Random ${TOKEN}`
      };

      const rows = await propertyRepository.getSubmissionFeatureProperties(featureId, { page: 1, limit: 25 });
      const codeRow = rows.find((row) => row.id.startsWith('code:'));
      expect(codeRow).to.not.be.undefined;
      expect(codeRow?.value).to.deep.equal(expected);

      const searchRow = await findSearchRow(featureTypeName, featureId);
      const searchValue = searchRow.properties[propertyName];
      expect(Array.isArray(searchValue) ? searchValue[0] : searchValue).to.deep.equal(expected);
    });

    it('omits codes that have been end-dated, on both read paths', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const codeId = await createCodesetCode(connection, 'stratified', `Stratified ${TOKEN}`, null, {
        key: `strategies_ended_${TOKEN}`
      });
      await addCodeProperty(connection, featureId, featureTypeName, propertyName, codeId);
      await connection.sql(SQL`
        UPDATE contributor_codeset_code SET record_end_date = now() - interval '1 day'
        WHERE contributor_codeset_code_id = ${codeId};
      `);

      const rows = await propertyRepository.getSubmissionFeatureProperties(featureId, { page: 1, limit: 25 });
      expect(rows.filter((row) => row.id.startsWith('code:'))).to.be.empty;

      const searchRow = await findSearchRow(featureTypeName, featureId);
      expect(searchRow.properties[propertyName]).to.be.undefined;
    });

    it('searches the properties list by the code label, not by the codeset key', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, featureTypeName, {});
      const codeId = await createCodesetCode(connection, 'systematic', `Systematic ${TOKEN}`, null, {
        key: `strategies_${TOKEN}`
      });
      await addCodeProperty(connection, featureId, featureTypeName, propertyName, codeId);

      const byLabel = await propertyRepository.getSubmissionFeatureProperties(
        featureId,
        { page: 1, limit: 25 },
        { search: `systematic ${TOKEN.toLowerCase()}` }
      );
      expect(byLabel.map((row) => row.id.split(':')[0])).to.deep.equal(['code']);

      const byCodesetKey = await propertyRepository.getSubmissionFeatureProperties(
        featureId,
        { page: 1, limit: 25 },
        { search: `strategies_${TOKEN.toLowerCase()}` }
      );
      expect(byCodesetKey).to.be.empty;
    });
  });

  describe('feature reference values', () => {
    const sourceFeatureTypeName = 'sample_period';
    const targetFeatureTypeName = 'sample_site';

    it('returns the same structured feature reference value from the search row and the properties list', async () => {
      const submissionId = await createTestSubmission(connection);
      const { featureTypePropertyId, propertyName } = await createFeatureTypeProperty(
        connection,
        sourceFeatureTypeName,
        targetFeatureTypeName
      );
      const targetId = await createTestFeature(connection, submissionId, targetFeatureTypeName, {});
      const sourceId = await createTestFeature(connection, submissionId, sourceFeatureTypeName, {});
      await insertSubmissionFeaturePropertyFeature(connection, sourceId, featureTypePropertyId, targetId);

      const urn = `urn:${submissionId}:${targetFeatureTypeName}:${targetId}`;
      const expected = { urn, label: urn };

      const rows = await propertyRepository.getSubmissionFeatureProperties(sourceId, { page: 1, limit: 25 });
      const featureRow = rows.find((row) => row.id.startsWith('feature:'));
      expect(featureRow).to.not.be.undefined;
      expect(featureRow?.value).to.deep.equal(expected);

      const searchRow = await findSearchRow(sourceFeatureTypeName, sourceId);
      const searchValue = searchRow.properties[propertyName];
      expect(Array.isArray(searchValue) ? searchValue[0] : searchValue).to.deep.equal(expected);
    });

    it('omits references to features that are no longer active', async () => {
      const submissionId = await createTestSubmission(connection);
      const { featureTypePropertyId } = await createFeatureTypeProperty(
        connection,
        sourceFeatureTypeName,
        targetFeatureTypeName
      );
      const targetId = await createTestFeature(connection, submissionId, targetFeatureTypeName, {});
      const sourceId = await createTestFeature(connection, submissionId, sourceFeatureTypeName, {});
      await insertSubmissionFeaturePropertyFeature(connection, sourceId, featureTypePropertyId, targetId);
      await connection.sql(SQL`
        UPDATE submission_feature SET record_end_date = now() - interval '1 day' WHERE submission_feature_id = ${targetId};
      `);

      const rows = await propertyRepository.getSubmissionFeatureProperties(sourceId, { page: 1, limit: 25 });
      expect(rows.filter((row) => row.id.startsWith('feature:'))).to.be.empty;
    });
  });
});
