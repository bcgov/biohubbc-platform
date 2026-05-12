// Integration test for SearchRepository — verifies complex SQL (CTEs, JSONB aggregation,
// multi-table joins, ILIKE search) executes correctly against the real database.
//
// The `_code` and `_taxon` value tables hold no production rows today (no feature_property is
// declared with type=code or type=taxon yet). The corpus widening is forward-looking — these
// tests insert into those value tables using any available feature_type_property_id; the
// FK only checks the referenced row exists, not that its declared type matches the value
// table, so this exercises the SQL path the schema is built to support.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SearchRepository } from '../../repositories/search-repository';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

// Deterministic token: no seeded value contains it, so the keyword can't match pre-existing data.
const TOKEN = 'INTSRCH976';

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
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  async function getFeatureTypePropertyId(featureTypeName: string, propertyName: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT ftp.feature_type_property_id
      FROM feature_type_property ftp
      JOIN feature_type ft ON ft.feature_type_id = ftp.feature_type_id
      JOIN feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      WHERE ft.name = ${featureTypeName}
        AND fp.name = ${propertyName}
        AND ftp.record_end_date IS NULL
      LIMIT 1;
    `);

    if (!result.rows[0]) {
      throw new Error(`No feature_type_property row for (${featureTypeName}, ${propertyName})`);
    }

    return result.rows[0].feature_type_property_id;
  }

  async function addStringProperty(
    submissionFeatureId: number,
    featureTypeName: string,
    propertyName: string,
    value: string
  ): Promise<void> {
    const systemUserId = connection.systemUserId();
    const ftpId = await getFeatureTypePropertyId(featureTypeName, propertyName);

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_string (submission_feature_id, feature_type_property_id, value, create_user)
      VALUES (${submissionFeatureId}, ${ftpId}, ${value}, ${systemUserId});
    `);
  }

  async function addCodeProperty(
    submissionFeatureId: number,
    featureTypeName: string,
    propertyName: string,
    contributorCodesetCodeId: number
  ): Promise<void> {
    const systemUserId = connection.systemUserId();
    const ftpId = await getFeatureTypePropertyId(featureTypeName, propertyName);

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_code (submission_feature_id, feature_type_property_id, contributor_codeset_code_id, create_user)
      VALUES (${submissionFeatureId}, ${ftpId}, ${contributorCodesetCodeId}, ${systemUserId});
    `);
  }

  async function addTaxonProperty(
    submissionFeatureId: number,
    featureTypeName: string,
    propertyName: string,
    taxonId: number
  ): Promise<void> {
    const systemUserId = connection.systemUserId();
    const ftpId = await getFeatureTypePropertyId(featureTypeName, propertyName);

    await connection.sql(SQL`
      INSERT INTO submission_feature_property_taxon (submission_feature_id, feature_type_property_id, taxon_id, create_user)
      VALUES (${submissionFeatureId}, ${ftpId}, ${taxonId}, ${systemUserId});
    `);
  }

  async function createCodesetCode(key: string, label: string, description: string | null = null): Promise<number> {
    const systemUserId = connection.systemUserId();
    const codesetKey = `int_test_${TOKEN}_${Date.now()}_${Math.random()}`;

    // Mirror createTestSubmission: ensure the SIMS contributor exists before referencing it.
    await connection.sql(SQL`
      INSERT INTO contributor (client_id, description)
      SELECT 'SIMS', 'Integration test contributor'
      WHERE NOT EXISTS (
        SELECT 1 FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL
      );
    `);

    const codesetResult = await connection.sql(SQL`
      INSERT INTO contributor_codeset (contributor_id, key, label, create_user)
      VALUES (
        (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
        ${codesetKey},
        ${'Codeset for ' + key},
        ${systemUserId}
      )
      RETURNING contributor_codeset_id;
    `);
    const codesetId = codesetResult.rows[0].contributor_codeset_id;

    const codeResult = await connection.sql(SQL`
      INSERT INTO contributor_codeset_code (contributor_codeset_id, key, label, description, create_user)
      VALUES (${codesetId}, ${key}, ${label}, ${description}, ${systemUserId})
      RETURNING contributor_codeset_code_id;
    `);

    return codeResult.rows[0].contributor_codeset_code_id;
  }

  // Auto-assigned `itis_tsn` for taxa where the test doesn't care about the TSN value.
  // taxon.itis_tsn is NOT NULL UNIQUE, so we need a fresh integer per row.
  let nextSyntheticTsn = 100_000_000;

  async function createTaxon(
    scientificName: string,
    commonName: string | null = null,
    tsn: number | null = null,
    bcCode: string | null = null
  ): Promise<number> {
    const systemUserId = connection.systemUserId();
    const effectiveTsn = tsn ?? nextSyntheticTsn++;

    const result = await connection.sql(SQL`
      INSERT INTO taxon (itis_scientific_name, common_name, itis_tsn, bc_taxon_code, itis_data, itis_update_date, create_user)
      VALUES (${scientificName}, ${commonName}, ${effectiveTsn}, ${bcCode}, '{}'::jsonb, now(), ${systemUserId})
      RETURNING taxon_id;
    `);
    return result.rows[0].taxon_id;
  }

  async function tombstoneCodesetCode(codesetCodeId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE contributor_codeset_code
      SET record_end_date = now()
      WHERE contributor_codeset_code_id = ${codesetCodeId};
    `);
  }

  async function tombstoneTaxon(taxonId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE taxon
      SET record_end_date = now()
      WHERE taxon_id = ${taxonId};
    `);
  }

  async function findFeatures(keyword: string) {
    return repo.findFeatures({ keyword }, { page: 1, limit: 50 });
  }

  // ── Existing shape smoke tests ──────────────────────────────────────────

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

    // ── Corpus widening ──────────────────────────────────────────────────

    it('matches string-property values (baseline corpus)', async () => {
      const keyword = `${TOKEN}_stringbase`;
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset alpha' });
      await addStringProperty(featureId, 'dataset', 'description', `moose habitat near ${keyword}`);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code-label values via the code arm', async () => {
      const keyword = `${TOKEN}_codelabel`;
      const codeId = await createCodesetCode('camera_trap', `${keyword} Camera trap`, 'Camera-based observations');
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST alpha' });
      await addCodeProperty(featureId, 'sample_technique', 'description', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code-description values via the code arm', async () => {
      const keyword = `${TOKEN}_codedesc`;
      const codeId = await createCodesetCode('motion_cam', 'Motion Camera', `${keyword} motion-activated lens`);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST beta' });
      await addCodeProperty(featureId, 'sample_technique', 'description', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code rows by their `key` column', async () => {
      const keyword = `${TOKEN}_keyonly`;
      const codeId = await createCodesetCode(keyword, 'Friendly label', 'Friendly description');
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST keyonly' });
      await addCodeProperty(featureId, 'sample_technique', 'description', codeId);

      const result = await findFeatures(keyword);

      // The keyword exists only in c.key — codeset keys aren't always numeric, so they are searched.
      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches taxon scientific name via the taxon arm', async () => {
      const keyword = `${TOKEN}_taxon`;
      const taxonId = await createTaxon(`Alces ${keyword}`, 'Moose');
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'animal', { animal_identifier: 'Bear-1' });
      await addTaxonProperty(featureId, 'animal', 'animal_identifier', taxonId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches taxon by ITIS TSN', async () => {
      const tsn = 9_876_543;
      const taxonId = await createTaxon(`Ursus ${TOKEN}`, 'Bear', tsn);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'animal', { animal_identifier: 'Bear-2' });
      await addTaxonProperty(featureId, 'animal', 'animal_identifier', taxonId);

      const result = await findFeatures(String(tsn));

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('hides tombstoned codeset code rows', async () => {
      const keyword = `${TOKEN}_dead_code`;
      const codeId = await createCodesetCode('dead', `${keyword} Camera`, null);
      await tombstoneCodesetCode(codeId);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST dead' });
      await addCodeProperty(featureId, 'sample_technique', 'description', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
    });

    it('hides tombstoned taxon rows', async () => {
      const keyword = `${TOKEN}_dead_taxon`;
      const taxonId = await createTaxon(`Vulpes ${keyword}`);
      await tombstoneTaxon(taxonId);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'animal', { animal_identifier: 'Fox-1' });
      await addTaxonProperty(featureId, 'animal', 'animal_identifier', taxonId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
    });

    // ── Allowlist + label fallback ────────────────────────────────────────

    it('surfaces new allowlist types via the matched-fragment label', async () => {
      const identifier = `${TOKEN}_bear37`;
      const submissionId = await createTestSubmission(connection);
      // `animal` features carry no `sf.data->>'name'` — label must fall back to the matched fragment.
      const featureId = await createTestFeature(connection, submissionId, 'animal', { animal_identifier: identifier });
      await addStringProperty(featureId, 'animal', 'animal_identifier', identifier);

      const result = await findFeatures(identifier);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
      expect(result.data[0].label).to.equal(identifier);
      expect(result.data[0].feature_type_name).to.equal('animal');
    });

    it('shows the canonical name when the keyword targets the name property', async () => {
      // Production happy path: name is stored in both sf.data AND in submission_feature_property_string.
      // A keyword hitting the name produces the name itself as the matched_value, which is what the
      // dropdown should show.
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'study_area', { name: 'Salmon River' });
      await addStringProperty(featureId, 'study_area', 'name', `Salmon ${TOKEN} River`);
      await addStringProperty(featureId, 'study_area', 'description', 'unrelated description text');

      const result = await findFeatures(`Salmon ${TOKEN}`);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
      expect(result.data[0].label).to.equal(`Salmon ${TOKEN} River`);
    });

    it('keeps non-allowlisted feature types out of the dropdown', async () => {
      // `measurement` is excluded from LANDING_PAGE_FEATURE_TYPES; it carries a `description` string property.
      const keyword = `${TOKEN}_excluded`;
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'measurement', { measurement_type: 'mass' });
      await addStringProperty(featureId, 'measurement', 'description', `payload ${keyword}`);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
      expect(result.data.find((r) => r.submission_feature_id === featureId)).to.equal(undefined);
    });

    // ── Dedup across arms ─────────────────────────────────────────────────

    it('emits one row when a feature matches in multiple arms', async () => {
      const keyword = `${TOKEN}_dedup`;
      const codeId = await createCodesetCode('dedupkey', `${keyword} method`, null);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST dedup' });
      // Feature matches the keyword via _string AND via _code.
      await addStringProperty(featureId, 'sample_technique', 'description', `also ${keyword} text`);
      await addCodeProperty(featureId, 'sample_technique', 'description', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });
  });

  describe('findFeatureSummary', () => {
    it('should return feature type summaries', async () => {
      const result = await repo.findFeatureSummary({ keyword: '' });

      expect(result).to.be.an('array');
      if (result.length > 0) {
        expect(result[0]).to.have.property('feature_type_name');
        expect(result[0]).to.have.property('total');
      }
    });

    it('counts a code-arm match (records/summary parity)', async () => {
      // Summary only counts priority types (dataset, species_observation, telemetry, report).
      // Verify the code corpus widening reaches the summary by seeding a `dataset` feature that
      // matches only via the code arm.
      const keyword = `${TOKEN}_summary_code`;
      const codeId = await createCodesetCode('summarycode', `${keyword} Agency`, null);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Summary dataset' });
      await addCodeProperty(featureId, 'dataset', 'description', codeId);

      const summary = await repo.findFeatureSummary({ keyword });
      const records = await findFeatures(keyword);

      const dataset = summary.find((s) => s.feature_type_name === 'dataset');
      expect(dataset?.total).to.equal(1);
      expect(records.total).to.equal(1);
      expect(records.data[0].submission_feature_id).to.equal(featureId);
    });

    it('does not count keyword hits on excluded feature types', async () => {
      const keyword = `${TOKEN}_summary_excluded`;
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'measurement', {
        measurement_type: 'mass'
      });
      await addStringProperty(featureId, 'measurement', 'description', `${keyword} payload`);

      const summary = await repo.findFeatureSummary({ keyword });

      // `measurement` is not in the allowlist and not a priority type — summary stays empty.
      expect(summary).to.be.an('array').with.lengthOf(0);
      expect(featureId).to.be.a('number');
    });
  });
});
