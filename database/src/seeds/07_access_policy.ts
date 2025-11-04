import { Knex } from 'knex';

/**
 * Inserts default access policies for accessing secured data
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  /** ------------------------------------------------------------------
   * 1. TELEMETRY POLICY + TEAM
   * ------------------------------------------------------------------ */
  const [telemetryPolicy] = await knex('policy')
    .insert({
      name: 'Telemetry Access',
      description: 'Grants read access to all Telemetry submission features'
    })
    .returning('*');

  const [telemetryTeam] = await knex('team')
    .insert({
      name: 'Telemetry Team',
      description: 'Team assigned to default Telemetry access policy'
    })
    .returning('*');

  await knex('team_policy').insert({
    team_id: telemetryTeam.team_id,
    policy_id: telemetryPolicy.policy_id
  });

  const [telemetryStatement] = await knex('policy_statement')
    .insert({
      policy_id: telemetryPolicy.policy_id,
      effect: 'allow',
      submission_feature_urn: 'urn:*:telemetry:*'
    })
    .returning('*');

  await knex('policy_statement_condition').insert({
    policy_statement_id: telemetryStatement.policy_statement_id,
    operator: 'DateBefore',
    key: 'start_date',
    value: JSON.stringify(new Date().toISOString())
  });

  // Add all non-system users (IDIR/BCEID) to Telemetry Team
  await knex.raw(`
    INSERT INTO team_member (system_user_id, team_id)
    SELECT su.system_user_id, '${telemetryTeam.team_id}'
    FROM "system_user" su
    WHERE su.user_identity_source_id IN (
      SELECT user_identity_source_id
      FROM user_identity_source
      WHERE LOWER(name) NOT IN ('system', 'database')
    );
  `);

  /** ------------------------------------------------------------------
   * 2. SAMPLING SITES TEAM
   * ------------------------------------------------------------------ */
  const [adminPolicy] = await knex('policy')
    .insert({
      name: 'Secret Sampling Sites Access',
      description: 'Grants unrestricted access to all submission features and data'
    })
    .returning('*');

  const [adminTeam] = await knex('team')
    .insert({
      name: 'Secret Sampling Sites Team',
      description: 'Team assigned to unrestricted administrative access'
    })
    .returning('*');

  await knex('team_policy').insert({
    team_id: adminTeam.team_id,
    policy_id: adminPolicy.policy_id
  });

  await knex('policy_statement')
    .insert({
      policy_id: adminPolicy.policy_id,
      effect: 'allow',
      submission_feature_urn: 'urn:*:sample_site:*'
    })
    .returning('*');

  // Do not add users to the sampling sites policy team, for confirming that only team members can access features covered by the policy
}
