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
import {
  addCodeProperty,
  addStringProperty,
  addTaxonProperty,
  createCodesetCode,
  createTaxon
} from '../helpers/test-feature-property-helpers';
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
      const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Survey alpha' });
      await addStringProperty(connection, featureId, 'survey', 'description', `moose habitat near ${keyword}`);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code-label values via the code arm', async () => {
      const keyword = `${TOKEN}_codelabel`;
      const codeId = await createCodesetCode(
        connection,
        'camera_trap',
        `${keyword} Camera trap`,
        'Camera-based observations'
      );
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST alpha' });
      await addCodeProperty(connection, featureId, 'sample_technique', 'attractant', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code-description values via the code arm', async () => {
      const keyword = `${TOKEN}_codedesc`;
      const codeId = await createCodesetCode(
        connection,
        'motion_cam',
        'Motion Camera',
        `${keyword} motion-activated lens`
      );
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST beta' });
      await addCodeProperty(connection, featureId, 'sample_technique', 'attractant', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches code rows by their `key` column', async () => {
      const keyword = `${TOKEN}_keyonly`;
      const codeId = await createCodesetCode(connection, keyword, 'Friendly label', 'Friendly description');
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST keyonly' });
      await addCodeProperty(connection, featureId, 'sample_technique', 'attractant', codeId);

      const result = await findFeatures(keyword);

      // The keyword exists only in c.key — codeset keys aren't always numeric, so they are searched.
      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches taxon scientific name via the taxon arm', async () => {
      const keyword = `${TOKEN}_taxon`;
      const taxonId = await createTaxon(connection, `Alces ${keyword}`, 'Moose');
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'habitat_feature', { name: 'Bear-1' });
      await addTaxonProperty(connection, featureId, 'habitat_feature', 'associated_species', taxonId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('matches taxon by ITIS TSN', async () => {
      const tsn = 9_876_543;
      const taxonId = await createTaxon(connection, `Ursus ${TOKEN}`, 'Bear', tsn);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'habitat_feature', { name: 'Bear-2' });
      await addTaxonProperty(connection, featureId, 'habitat_feature', 'associated_species', taxonId);

      const result = await findFeatures(String(tsn));

      expect(result.total).to.equal(1);
      expect(result.data[0].submission_feature_id).to.equal(featureId);
    });

    it('hides tombstoned codeset code rows', async () => {
      const keyword = `${TOKEN}_dead_code`;
      const codeId = await createCodesetCode(connection, 'dead', `${keyword} Camera`, null);
      await tombstoneCodesetCode(codeId);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST dead' });
      await addCodeProperty(connection, featureId, 'sample_technique', 'attractant', codeId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
    });

    it('hides tombstoned taxon rows', async () => {
      const keyword = `${TOKEN}_dead_taxon`;
      const taxonId = await createTaxon(connection, `Vulpes ${keyword}`);
      await tombstoneTaxon(taxonId);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'habitat_feature', { name: 'Fox-1' });
      await addTaxonProperty(connection, featureId, 'habitat_feature', 'associated_species', taxonId);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
    });

    // ── Allowlist + label fallback ────────────────────────────────────────

    it('surfaces new allowlist types via the matched-fragment label', async () => {
      const identifier = `${TOKEN}_bear37`;
      const submissionId = await createTestSubmission(connection);
      // `animal` features carry no `sf.data->>'name'` — label must fall back to the matched fragment.
      const featureId = await createTestFeature(connection, submissionId, 'animal', { animal_identifier: identifier });
      await addStringProperty(connection, featureId, 'animal', 'animal_identifier', identifier);

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
      await addStringProperty(connection, featureId, 'study_area', 'name', `Salmon ${TOKEN} River`);
      await addStringProperty(connection, featureId, 'study_area', 'description', 'unrelated description text');

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
      await addStringProperty(connection, featureId, 'measurement', 'description', `payload ${keyword}`);

      const result = await findFeatures(keyword);

      expect(result.total).to.equal(0);
      expect(result.data.find((r) => r.submission_feature_id === featureId)).to.equal(undefined);
    });

    // ── Dedup across arms ─────────────────────────────────────────────────

    it('emits one row when a feature matches in multiple arms', async () => {
      const keyword = `${TOKEN}_dedup`;
      const codeId = await createCodesetCode(connection, 'dedupkey', `${keyword} method`, null);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'sample_technique', { name: 'ST dedup' });
      // Feature matches the keyword via _string AND via _code.
      await addStringProperty(connection, featureId, 'sample_technique', 'description', `also ${keyword} text`);
      await addCodeProperty(connection, featureId, 'sample_technique', 'attractant', codeId);

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
      // Summary only counts priority types (survey, species_observation, telemetry, report).
      // Verify the code corpus widening reaches the summary by seeding a `survey` feature that
      // matches only via the code arm.
      const keyword = `${TOKEN}_summary_code`;
      const codeId = await createCodesetCode(connection, 'summarycode', `${keyword} Agency`, null);
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Summary survey' });
      await addCodeProperty(connection, featureId, 'survey', 'collected_data', codeId);

      const summary = await repo.findFeatureSummary({ keyword });
      const records = await findFeatures(keyword);

      const survey = summary.find((s) => s.feature_type_name === 'survey');
      expect(survey?.total).to.equal(1);
      expect(records.total).to.equal(1);
      expect(records.data[0].submission_feature_id).to.equal(featureId);
    });

    it('does not count keyword hits on excluded feature types', async () => {
      const keyword = `${TOKEN}_summary_excluded`;
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'measurement', {
        measurement_type: 'mass'
      });
      await addStringProperty(connection, featureId, 'measurement', 'description', `${keyword} payload`);

      const summary = await repo.findFeatureSummary({ keyword });

      // `measurement` is not in the allowlist and not a priority type — summary stays empty.
      expect(summary).to.be.an('array').with.lengthOf(0);
      expect(featureId).to.be.a('number');
    });
  });
});
