import { Knex } from 'knex';

/**
 * Inserts default access policies for accessing secured data.
 * Idempotent: safe to run when policies/teams already exist (e.g. re-run in test).
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

  // Resolve create_user for inserts (audit trigger may set it; fallback for environments where it does not)
  const createUserRow = await knex('system_user').whereNull('record_end_date').select('system_user_id').first();
  const createUser = createUserRow?.system_user_id ?? 1;

  /** ------------------------------------------------------------------
   * 1. TELEMETRY POLICY + TEAM
   * ------------------------------------------------------------------ */
  let telemetryPolicy = await knex('policy').where({ name: 'Telemetry Access' }).whereNull('record_end_date').first();

  if (!telemetryPolicy) {
    const [inserted] = await knex('policy')
      .insert({
        name: 'Telemetry Access',
        description: 'Grants read access to all Telemetry submission features',
        create_user: createUser
      })
      .returning('*');
    telemetryPolicy = inserted;
  }

  let telemetryTeam = await knex('team').where({ name: 'Telemetry Team' }).whereNull('record_end_date').first();

  if (!telemetryTeam) {
    const [inserted] = await knex('team')
      .insert({
        name: 'Telemetry Team',
        description: 'Team assigned to default Telemetry access policy',
        create_user: createUser
      })
      .returning('*');
    telemetryTeam = inserted;
  }

  const telemetryTeamPolicyExists = await knex('team_policy')
    .where({
      team_id: telemetryTeam.team_id,
      policy_id: telemetryPolicy.policy_id
    })
    .whereNull('record_end_date')
    .first();

  if (!telemetryTeamPolicyExists) {
    await knex('team_policy').insert({
      team_id: telemetryTeam.team_id,
      policy_id: telemetryPolicy.policy_id,
      create_user: createUser
    });
  }

  let telemetryStatement = await knex('policy_statement')
    .where({
      policy_id: telemetryPolicy.policy_id,
      effect: 'allow',
      submission_feature_urn: 'urn:*:telemetry:*'
    })
    .whereNull('record_end_date')
    .first();

  if (!telemetryStatement) {
    const [inserted] = await knex('policy_statement')
      .insert({
        policy_id: telemetryPolicy.policy_id,
        effect: 'allow',
        submission_feature_urn: 'urn:*:telemetry:*',
        create_user: createUser
      })
      .returning('*');
    telemetryStatement = inserted;
  }

  const telemetryConditionValue = JSON.stringify(new Date().toISOString());
  const telemetryConditionExists = await knex('policy_statement_condition')
    .where({
      policy_statement_id: telemetryStatement.policy_statement_id,
      operator: 'DateBefore',
      key: 'start_date',
      value: telemetryConditionValue
    })
    .whereNull('record_end_date')
    .first();

  if (!telemetryConditionExists) {
    await knex('policy_statement_condition').insert({
      policy_statement_id: telemetryStatement.policy_statement_id,
      operator: 'DateBefore',
      key: 'start_date',
      value: telemetryConditionValue,
      create_user: createUser
    });
  }

  // Add all non-system users (IDIR/BCEID) to Telemetry Team (skip if already member)
  await knex.raw(
    `
    INSERT INTO team_member (system_user_id, team_id, create_user)
    SELECT su.system_user_id, ?, (SELECT system_user_id FROM "system_user" WHERE record_end_date IS NULL LIMIT 1)
    FROM "system_user" su
    WHERE su.user_identity_source_id IN (
      SELECT user_identity_source_id
      FROM user_identity_source
      WHERE LOWER(name) NOT IN ('system', 'database')
    )
    AND NOT EXISTS (
      SELECT 1 FROM team_member tm
      WHERE tm.system_user_id = su.system_user_id AND tm.team_id = ?
    );
  `,
    [telemetryTeam.team_id, telemetryTeam.team_id]
  );

  /** ------------------------------------------------------------------
   * 2. SAMPLING SITES TEAM
   * ------------------------------------------------------------------ */
  let adminPolicy = await knex('policy')
    .where({ name: 'Secret Sampling Sites Access' })
    .whereNull('record_end_date')
    .first();

  if (!adminPolicy) {
    const [inserted] = await knex('policy')
      .insert({
        name: 'Secret Sampling Sites Access',
        description: 'Grants unrestricted access to all submission features and data',
        create_user: createUser
      })
      .returning('*');
    adminPolicy = inserted;
  }

  let adminTeam = await knex('team').where({ name: 'Secret Sampling Sites Team' }).whereNull('record_end_date').first();

  if (!adminTeam) {
    const [inserted] = await knex('team')
      .insert({
        name: 'Secret Sampling Sites Team',
        description: 'Team assigned to unrestricted administrative access',
        create_user: createUser
      })
      .returning('*');
    adminTeam = inserted;
  }

  const adminTeamPolicyExists = await knex('team_policy')
    .where({
      team_id: adminTeam.team_id,
      policy_id: adminPolicy.policy_id
    })
    .whereNull('record_end_date')
    .first();

  if (!adminTeamPolicyExists) {
    await knex('team_policy').insert({
      team_id: adminTeam.team_id,
      policy_id: adminPolicy.policy_id,
      create_user: createUser
    });
  }

  const adminStatementExists = await knex('policy_statement')
    .where({
      policy_id: adminPolicy.policy_id,
      effect: 'allow',
      submission_feature_urn: 'urn:*:sample_site:*'
    })
    .whereNull('record_end_date')
    .first();

  if (!adminStatementExists) {
    await knex('policy_statement').insert({
      policy_id: adminPolicy.policy_id,
      effect: 'allow',
      submission_feature_urn: 'urn:*:sample_site:*',
      create_user: createUser
    });
  }

  // Do not add users to the sampling sites policy team, for confirming that only team members can access features covered by the policy

  /** ------------------------------------------------------------------
   * 3. SECURE FEATURES + WIRE SCOPE TABLES
   *
   * Mark some seeded dataset features as secured so the lock icon
   * appears in the search UI. Then wire the normalized scope tables
   * (security_scope → policy_statement_scope → security_scope_anchor
   * → team_security_scope) so that team members can access them.
   *
   * Pattern mirrors docs/SIMSBIOHUB-914/sql/scale-data-scopes.sql
   * ------------------------------------------------------------------ */

  // 3a. Mark the first 3 dataset features as secured.
  //     Resolve IDs dynamically instead of hardcoding (IDs are not stable across environments).
  const securedDatasetRows = await knex('submission_feature as sf')
    .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
    .where('ft.name', 'dataset')
    .whereNull('sf.record_end_date')
    .orderBy('sf.submission_feature_id', 'asc')
    .select('sf.submission_feature_id')
    .limit(3);

  const securedDatasetIds = securedDatasetRows.map((row) => row.submission_feature_id);

  // Use first security rule available
  const firstRule = await knex('security_rule').whereNull('record_end_date').select('security_rule_id').first();
  if (!firstRule) {
    return; // no security rules seeded — skip scope wiring
  }

  for (const featureId of securedDatasetIds) {
    const exists = await knex('submission_feature_security')
      .where({ submission_feature_id: featureId, security_rule_id: firstRule.security_rule_id })
      .first();

    if (!exists) {
      await knex('submission_feature_security').insert({
        submission_feature_id: featureId,
        security_rule_id: firstRule.security_rule_id,
        create_user: createUser
      });
    }
  }

  // 3b. Create security scopes for each policy statement URN
  const statements = [
    { statement: telemetryStatement, urn: 'urn:*:telemetry:*', team: telemetryTeam },
    {
      statement: await knex('policy_statement')
        .where({ policy_id: adminPolicy.policy_id, submission_feature_urn: 'urn:*:sample_site:*' })
        .whereNull('record_end_date')
        .first(),
      urn: 'urn:*:sample_site:*',
      team: adminTeam
    }
  ];

  for (const { statement, urn, team } of statements) {
    if (!statement) {
      continue;
    }

    // scope_hash = sha256 of the URN (matches API SecurityScopeRepository pattern)
    const scopeHashResult = await knex.raw(`SELECT encode(sha256(?::BYTEA), 'hex') as hash`, [urn]);
    const scopeHash = scopeHashResult.rows[0].hash;

    // Insert or find the security_scope
    let scope = await knex('security_scope').where({ scope_hash: scopeHash }).first();
    if (!scope) {
      const [inserted] = await knex('security_scope').insert({ scope_hash: scopeHash }).returning('*');
      scope = inserted;
    }

    // Link policy_statement → scope
    const pssExists = await knex('policy_statement_scope')
      .where({ policy_statement_id: statement.policy_statement_id })
      .first();
    if (!pssExists) {
      await knex('policy_statement_scope').insert({
        policy_statement_id: statement.policy_statement_id,
        security_scope_id: scope.security_scope_id
      });
    }

    // Anchor the scope to each secured dataset
    for (const featureId of securedDatasetIds) {
      const anchorExists = await knex('security_scope_anchor')
        .where({ security_scope_id: scope.security_scope_id, anchor_submission_feature_id: featureId })
        .first();
      if (!anchorExists) {
        await knex('security_scope_anchor').insert({
          security_scope_id: scope.security_scope_id,
          anchor_submission_feature_id: featureId
        });
      }
    }

    // Grant team access to the scope
    const tssExists = await knex('team_security_scope')
      .where({ team_id: team.team_id, security_scope_id: scope.security_scope_id })
      .first();
    if (!tssExists) {
      await knex('team_security_scope').insert({
        team_id: team.team_id,
        security_scope_id: scope.security_scope_id
      });
    }
  }
}
