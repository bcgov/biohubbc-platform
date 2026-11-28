import type { Knex } from 'knex';

/**
 * Grant every existing submission's team an approved access policy over the submission's features.
 *
 * New submissions receive this policy when they are created (`SubmissionService.insertSubmissionRecord`). This
 * backfills the same policy for submissions created before then, so a submission team's feature access is always
 * managed through `team_policy` like any other grant.
 *
 * For each active submission whose active team does not already hold a scope over `urn:<submission_id>:*:*`, this
 * writes the same rows the API writes: the reusable `security_scope` (shared by hash), an approved `policy` named
 * `Submission Policy <uuid>`, its single `allow` statement, the `team_policy` link and the derived
 * `team_security_scope` grant.
 *
 * Search reads secured features through scope anchors, which this migration does not compute. Secured features in a
 * backfilled submission appear in its team's search results once anchors are next computed for the submission (on its
 * next approved upload or security change). The submission's own feature routes match the grant directly and are not
 * affected.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE TEMPORARY TABLE submission_policy_backfill ON COMMIT DROP AS
    SELECT
      s.submission_id,
      s.uuid,
      s.team_id,
      s.create_user,
      gen_random_uuid() AS policy_id,
      encode(sha256(convert_to('urn:' || s.submission_id || ':*:*', 'UTF8')), 'hex') AS scope_hash
    FROM submission s
    JOIN team t
      ON t.team_id = s.team_id
      AND t.record_end_date IS NULL
    WHERE s.record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM team_security_scope tss
        JOIN security_scope ss
          ON ss.security_scope_id = tss.security_scope_id
        WHERE tss.team_id = s.team_id
          AND ss.urn_submission_id = s.submission_id::text
          AND ss.urn_feature_type = '*'
          AND ss.urn_feature_id = '*'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM policy p
        WHERE p.name = 'Submission Policy ' || s.uuid
          AND p.record_end_date IS NULL
      );

    INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
    SELECT scope_hash, submission_id::text, '*', '*'
    FROM submission_policy_backfill
    ON CONFLICT (scope_hash) DO NOTHING;

    INSERT INTO policy (policy_id, name, description, status, create_user)
    SELECT
      policy_id,
      'Submission Policy ' || uuid,
      'Auto-generated policy granting the team of submission ' || uuid || ' access to its features.',
      'approved',
      create_user
    FROM submission_policy_backfill;

    INSERT INTO policy_statement (policy_id, effect, security_scope_id, create_user)
    SELECT backfill.policy_id, 'allow', ss.security_scope_id, backfill.create_user
    FROM submission_policy_backfill backfill
    JOIN security_scope ss
      ON ss.scope_hash = backfill.scope_hash;

    INSERT INTO team_policy (team_id, policy_id, create_user)
    SELECT team_id, policy_id, create_user
    FROM submission_policy_backfill;

    INSERT INTO team_security_scope (team_id, security_scope_id)
    SELECT backfill.team_id, ss.security_scope_id
    FROM submission_policy_backfill backfill
    JOIN security_scope ss
      ON ss.scope_hash = backfill.scope_hash
    ON CONFLICT (team_id, security_scope_id) DO NOTHING;
  `);
}

/**
 * Not reversible: the backfilled policies cannot be told apart from those created by the API.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`SELECT 1;`);
}
