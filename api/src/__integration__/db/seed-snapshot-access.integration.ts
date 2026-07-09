// Integration test for the seeded snapshot access wiring — verifies that the standing
// Telemetry-Team grant lets a team member read the Moose-secured telemetry while an
// anonymous (null) caller cannot, and that unsecured telemetry stays visible to both.
//
// This is a seed-WIRING smoke test: it deliberately reads the pre-seeded snapshot data
// (team grant + Boreal Moose submission) rather than minting its own fixtures. The
// member-vs-non-member access MECHANISM is covered separately by
// security-scope-search.integration.ts — here we only prove the seed hooked it up.
//
// No writes occur; the per-test rollback is for connection hygiene only. There is no
// mocking — the read path does not publish anchor-compute jobs.
//
// Run: make test-db
// Requires: make web (seeds 07 + 10 — the Telemetry Team grant + the Boreal Moose snapshot)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';

describe('Seed snapshot access (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let searchRepo: SearchFeatureRepository;

  // The snapshot's ids are regenerated on every seed replay, so they are resolved by
  // natural key (submission name, team name, feature type + closure ancestry) rather
  // than hard-coded — a hard-coded id would silently drift after a reseed.
  let submissionId: number;
  let memberSystemUserId: number;
  let securedTelemetryId: number;
  let unsecuredTelemetryId: number;

  before(async () => {
    initDBPool(defaultPoolConfig);

    connection = getAPIUserDBConnection();
    await connection.open();
    searchRepo = new SearchFeatureRepository(connection);

    submissionId = await resolveSubmissionId();
    memberSystemUserId = await resolveMemberSystemUserId();
    securedTelemetryId = await resolveSecuredTelemetryId(submissionId);
    unsecuredTelemetryId = await resolveUnsecuredTelemetryId(submissionId);
  });

  after(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Fixture resolution ───────────────────────────────────────────────

  /**
   * Resolve the Boreal Moose snapshot submission by its natural key (name).
   *
   * The submission_id is regenerated on every seed replay, so it is looked up by the
   * stable seed name rather than hard-coded.
   */
  async function resolveSubmissionId(): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT submission_id
      FROM submission
      WHERE name = 'Boreal Moose'
        AND record_end_date IS NULL
      LIMIT 1;
    `);
    return result.rows[0]?.submission_id;
  }

  /**
   * Resolve one real (non-system/database) member of the seeded Telemetry Team.
   *
   * Team membership and user ids are regenerated on replay, so the member is resolved by
   * the stable team name and by excluding the built-in system/database identity sources.
   */
  async function resolveMemberSystemUserId(): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT tm.system_user_id
      FROM team_member tm
      JOIN team t ON t.team_id = tm.team_id AND t.record_end_date IS NULL
      JOIN "system_user" su ON su.system_user_id = tm.system_user_id AND su.record_end_date IS NULL
      JOIN user_identity_source uis ON uis.user_identity_source_id = su.user_identity_source_id
      WHERE t.name = 'Telemetry Team'
        AND tm.record_end_date IS NULL
        AND LOWER(uis.name) NOT IN ('system', 'database')
      LIMIT 1;
    `);
    return result.rows[0]?.system_user_id;
  }

  /**
   * Resolve one effectively-secured telemetry feature within the snapshot submission.
   *
   * Effective security mirrors the read path's isEffectivelySecured fragment: a feature is
   * secured when its closure ancestry (source = self, is_ancestor = true) reaches a target
   * with an active submission_feature_security row. Resolved dynamically because the
   * snapshot's feature ids are regenerated on every replay.
   */
  async function resolveSecuredTelemetryId(submissionId: number): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT sf.submission_feature_id
      FROM submission_feature sf
      JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE ft.name = 'telemetry'
        AND sf.submission_id = ${submissionId}
        AND sf.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure c
          JOIN submission_feature_security sfs
            ON sfs.submission_feature_id = c.target_submission_feature_id
            AND sfs.record_end_date IS NULL
          WHERE c.source_submission_feature_id = sf.submission_feature_id
            AND c.is_ancestor = true
        )
      LIMIT 1;
    `);
    return result.rows[0]?.submission_feature_id;
  }

  /**
   * Resolve one effectively-unsecured telemetry feature within the snapshot submission.
   *
   * The inverse of resolveSecuredTelemetryId — no closure ancestor carries an active
   * security row. Resolved dynamically for the same reason: snapshot ids drift on replay.
   */
  async function resolveUnsecuredTelemetryId(submissionId: number): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT sf.submission_feature_id
      FROM submission_feature sf
      JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE ft.name = 'telemetry'
        AND sf.submission_id = ${submissionId}
        AND sf.record_end_date IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_closure c
          JOIN submission_feature_security sfs
            ON sfs.submission_feature_id = c.target_submission_feature_id
            AND sfs.record_end_date IS NULL
          WHERE c.source_submission_feature_id = sf.submission_feature_id
            AND c.is_ancestor = true
        )
      LIMIT 1;
    `);
    return result.rows[0]?.submission_feature_id;
  }

  /**
   * Search telemetry by expression tree, bounded to the snapshot submission.
   *
   * The snapshot shares telemetry feature types with other synthetic submissions, so every
   * result is filtered down to submissionId. systemUserId: null = anonymous, number = authenticated.
   */
  async function searchInSubmission(
    submissionId: number,
    systemUserId?: number | null
  ): Promise<{ submission_feature_id: number; is_secured: boolean }[]> {
    const results = await searchRepo.searchFeaturesByExpressionTree('telemetry', undefined, undefined, systemUserId);
    return results
      .filter((r) => r.submission_id === submissionId)
      .map((r) => ({ submission_feature_id: r.submission_feature_id, is_secured: r.is_secured }));
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it('resolves the seeded snapshot fixtures', () => {
    expect(submissionId, 'seed 10 Boreal Moose submission not found — did make web run seeds 07+10?').to.be.a('number');
    expect(memberSystemUserId).to.be.a('number');
    expect(securedTelemetryId, 'no effectively-secured telemetry found in the seeded snapshot').to.be.a('number');
    expect(unsecuredTelemetryId).to.be.a('number');
  });

  it('grants a Telemetry Team member access to the Moose-secured telemetry', async () => {
    const results = await searchInSubmission(submissionId, memberSystemUserId);
    const featureIds = results.map((r) => r.submission_feature_id);

    expect(featureIds).to.include(securedTelemetryId);

    // The row is secured-but-accessible via the standing grant, not merely present as an unsecured row.
    const row = results.find((r) => r.submission_feature_id === securedTelemetryId);
    expect(row?.is_secured).to.be.true;
  });

  it('hides the Moose-secured telemetry from an anonymous caller', async () => {
    const results = await searchInSubmission(submissionId, null);
    const featureIds = results.map((r) => r.submission_feature_id);

    expect(featureIds).to.not.include(securedTelemetryId);
  });

  it('shows unsecured telemetry to both member and anonymous callers', async () => {
    const memberResults = await searchInSubmission(submissionId, memberSystemUserId);
    const anonymousResults = await searchInSubmission(submissionId, null);

    expect(memberResults.map((r) => r.submission_feature_id)).to.include(unsecuredTelemetryId);
    expect(anonymousResults.map((r) => r.submission_feature_id)).to.include(unsecuredTelemetryId);
  });
});
