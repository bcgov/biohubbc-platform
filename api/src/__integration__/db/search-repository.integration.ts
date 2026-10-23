// Integration test for SearchRepository — verifies the keyword summary SQL (CTEs, multi-table joins, ILIKE search and
// caller security) executes correctly against the real database.
//
// The `_code` and `_taxon` value tables hold no production rows today (no feature_property is
// declared with type=code or type=taxon yet). The corpus widening is forward-looking — these
// tests insert into those value tables using any available blueprint_feature_type_property_id; the
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
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SearchRepository } from '../../repositories/search-repository';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { addCodeProperty, addStringProperty, createCodesetCode } from '../helpers/test-feature-property-helpers';
import { secureFeature, setupFullAccess } from '../helpers/test-rbac-helpers';
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

  /**
   * Create a published survey in its own submission carrying a searchable description, with its closure built so the
   * security filter can resolve it as it would after the post-approval rebuild.
   */
  async function createSearchableSurvey(description: string): Promise<{ submissionId: number; featureId: number }> {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Summary survey' });
    await addStringProperty(connection, featureId, 'description', description);
    await new SubmissionFeatureClosureService(connection).computeClosureForSubmission(submissionId);
    return { submissionId, featureId };
  }

  function surveyTotal(summary: { feature_type_name: string; total: number }[]): number | undefined {
    return summary.find((row) => row.feature_type_name === 'survey')?.total;
  }

  describe('findSubmissionSummary', () => {
    it('should return a total count', async () => {
      const result = await repo.findSubmissionSummary({ keyword: '' });

      expect(result).to.have.property('total').that.is.a('number');
      expect(result.total).to.be.gte(0);
    });
  });

  describe('findFeatureSummary', () => {
    it('should return feature type summaries', async () => {
      const result = await repo.findFeatureSummary({ keyword: '' }, null);

      expect(result).to.be.an('array');
      if (result.length > 0) {
        expect(result[0]).to.have.property('feature_type_name');
        expect(result[0]).to.have.property('total');
      }
    });

    it('counts a string-property match', async () => {
      const keyword = `${TOKEN}_summary_string`;
      await createSearchableSurvey(`moose habitat near ${keyword}`);

      expect(surveyTotal(await repo.findFeatureSummary({ keyword }, null))).to.equal(1);
    });

    it('counts a code-arm match', async () => {
      const keyword = `${TOKEN}_summary_code`;
      const codeId = await createCodesetCode(connection, 'summarycode', `${keyword} Agency`, null);
      const { submissionId, featureId } = await createSearchableSurvey('no keyword here');
      await addCodeProperty(connection, featureId, 'collected_data', codeId);
      await new SubmissionFeatureClosureService(connection).computeClosureForSubmission(submissionId);

      expect(surveyTotal(await repo.findFeatureSummary({ keyword }, null))).to.equal(1);
    });

    it('does not count retired codeset code rows', async () => {
      const keyword = `${TOKEN}_summary_dead_code`;
      const codeId = await createCodesetCode(connection, 'deadcode', `${keyword} Camera`, null);
      await connection.sql(SQL`
        UPDATE contributor_codeset_code SET record_end_date = now() WHERE contributor_codeset_code_id = ${codeId};
      `);
      const { featureId } = await createSearchableSurvey('no keyword here');
      await addCodeProperty(connection, featureId, 'collected_data', codeId);

      expect(await repo.findFeatureSummary({ keyword }, null))
        .to.be.an('array')
        .with.lengthOf(0);
    });

    it('does not count keyword hits on excluded feature types', async () => {
      const keyword = `${TOKEN}_summary_excluded`;
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'measurement', {
        measurement_type: 'mass'
      });
      await addStringProperty(connection, featureId, 'description', `${keyword} payload`);
      await new SubmissionFeatureClosureService(connection).computeClosureForSubmission(submissionId);

      // `measurement` is not in the allowlist and not a priority type — summary stays empty.
      expect(await repo.findFeatureSummary({ keyword }, null))
        .to.be.an('array')
        .with.lengthOf(0);
    });
  });

  describe('findFeatureSummary security', () => {
    it('does not count secured features for an anonymous caller', async () => {
      const keyword = `${TOKEN}_summary_secured`;
      const secured = await createSearchableSurvey(`${keyword} secured`);
      await createSearchableSurvey(`${keyword} open`);
      await secureFeature(connection, secured.featureId);

      expect(surveyTotal(await repo.findFeatureSummary({ keyword }, null))).to.equal(1);
    });

    it('counts secured features for a caller whose team holds a scope over them', async () => {
      const keyword = `${TOKEN}_summary_scoped`;
      const secured = await createSearchableSurvey(`${keyword} secured`);
      await secureFeature(connection, secured.featureId);
      const userId = connection.systemUserId();
      await setupFullAccess(
        connection,
        new SecurityScopeRepository(connection),
        `urn:${secured.submissionId}:*:*`,
        userId,
        'summary-scope-team'
      );

      expect(await repo.findFeatureSummary({ keyword }, null))
        .to.be.an('array')
        .with.lengthOf(0);
      expect(surveyTotal(await repo.findFeatureSummary({ keyword }, userId))).to.equal(1);
    });

    it('does not count superseded features or features whose closure is not built', async () => {
      const keyword = `${TOKEN}_summary_lifecycle`;
      const superseded = await createSearchableSurvey(`${keyword} old`);
      const successor = await createTestFeature(connection, superseded.submissionId, 'survey', { name: 'New' });
      await connection.sql(SQL`
        UPDATE submission_feature
        SET record_end_date = now(), successor_submission_feature_id = ${successor}
        WHERE submission_feature_id = ${superseded.featureId};
      `);
      await new SubmissionFeatureClosureService(connection).computeClosureForSubmission(superseded.submissionId);
      const unbuiltSubmissionId = await createTestSubmission(connection);
      const unbuilt = await createTestFeature(connection, unbuiltSubmissionId, 'survey', { name: 'Unbuilt' });
      await addStringProperty(connection, unbuilt, 'description', `${keyword} unbuilt`);

      expect(await repo.findFeatureSummary({ keyword }, null))
        .to.be.an('array')
        .with.lengthOf(0);
    });
  });
});
