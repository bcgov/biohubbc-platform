import { Knex } from 'knex';

/**
 * Adds a policy reference to each security rule.
 *
 * Notes:
 * - One policy row is created per existing security_rule row.
 * - One policy_statement row is created per mapped policy, and expression links
 *   are bridged from security_rule_expression to policy_statement_expression.
 * - Rollback removes bridged policy statement rows and links, plus the
 *   security_rule foreign key/index/column. It intentionally keeps policy rows.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Validate source data before creating mapped policies.
    --------------------------------------------------------------------------------
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM security_rule sr
        WHERE sr.record_end_date IS NULL
        GROUP BY sr.name
        HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION
          'Cannot map security_rule -> policy: duplicate active security_rule.name values detected';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM security_rule sr
        JOIN policy p ON p.name = sr.name
        WHERE sr.record_end_date IS NULL
          AND p.record_end_date IS NULL
      ) THEN
        RAISE EXCEPTION
          'Cannot map security_rule -> policy: an active policy already exists for at least one active security rule name';
      END IF;
    END $$;

    --------------------------------------------------------------------------------
    -- Build deterministic security_rule_id -> policy_id map.
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_security_rule_policy_map (
      security_rule_id integer PRIMARY KEY,
      policy_id uuid NOT NULL
    );

    INSERT INTO tmp_security_rule_policy_map (security_rule_id, policy_id)
    SELECT
      sr.security_rule_id,
      public.gen_random_uuid()
    FROM security_rule sr;

    --------------------------------------------------------------------------------
    -- Create one policy per security rule.
    --------------------------------------------------------------------------------
    INSERT INTO policy (
      policy_id,
      name,
      description,
      record_end_date,
      create_user,
      status
    )
    SELECT
      map.policy_id,
      sr.name,
      COALESCE(sr.description, 'Auto-generated policy for security rule "' || sr.name || '"'),
      sr.record_end_date,
      sr.create_user,
      'approved'::policy_status
    FROM security_rule sr
    JOIN tmp_security_rule_policy_map map
      ON map.security_rule_id = sr.security_rule_id;

    --------------------------------------------------------------------------------
    -- Add and backfill security_rule.policy_id, then enforce integrity.
    --------------------------------------------------------------------------------
    ALTER TABLE security_rule
      ADD COLUMN policy_id uuid;

    UPDATE security_rule sr
    SET policy_id = map.policy_id
    FROM tmp_security_rule_policy_map map
    WHERE map.security_rule_id = sr.security_rule_id;

    ALTER TABLE security_rule
      ALTER COLUMN policy_id SET NOT NULL,
      ADD CONSTRAINT security_rule_policy_fk
        FOREIGN KEY (policy_id) REFERENCES policy(policy_id);

    CREATE INDEX idx_security_rule_policy_id ON security_rule(policy_id);

    --------------------------------------------------------------------------------
    -- Create one policy statement per mapped policy.
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_security_rule_policy_statement_map (
      security_rule_id integer PRIMARY KEY,
      policy_statement_id uuid NOT NULL
    );

    INSERT INTO policy_statement (
      policy_id,
      effect,
      submission_feature_urn,
      record_end_date,
      create_user
    )
    SELECT
      map.policy_id,
      'ALLOW'::policy_effect,
      'urn:*:*:*',
      sr.record_end_date,
      sr.create_user
    FROM security_rule sr
    JOIN tmp_security_rule_policy_map map
      ON map.security_rule_id = sr.security_rule_id;

    INSERT INTO tmp_security_rule_policy_statement_map (security_rule_id, policy_statement_id)
    SELECT
      map.security_rule_id,
      ps.policy_statement_id
    FROM tmp_security_rule_policy_map map
    JOIN policy_statement ps
      ON ps.policy_id = map.policy_id
    WHERE ps.submission_feature_urn = 'urn:*:*:*'
      AND ps.effect = 'ALLOW'::policy_effect
      AND ps.record_end_date IS NOT DISTINCT FROM (
        SELECT sr.record_end_date
        FROM security_rule sr
        WHERE sr.security_rule_id = map.security_rule_id
      );

    --------------------------------------------------------------------------------
    -- Bridge active security rule expression links to policy statements.
    --------------------------------------------------------------------------------
    INSERT INTO policy_statement_expression (
      policy_statement_id,
      expression_id,
      create_user
    )
    SELECT
      statement_map.policy_statement_id,
      sre.expression_id,
      sre.create_user
    FROM security_rule_expression sre
    JOIN tmp_security_rule_policy_statement_map statement_map
      ON statement_map.security_rule_id = sre.security_rule_id
    WHERE sre.record_end_date IS NULL;

    COMMENT ON COLUMN security_rule.policy_id IS
      'Foreign key to the policy that defines feature-matching logic for this security rule.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DELETE FROM policy_statement_expression pse
    USING policy_statement ps, security_rule sr
    WHERE pse.policy_statement_id = ps.policy_statement_id
      AND ps.policy_id = sr.policy_id;

    DELETE FROM policy_statement ps
    USING security_rule sr
    WHERE ps.policy_id = sr.policy_id;

    DROP INDEX IF EXISTS idx_security_rule_policy_id;

    ALTER TABLE security_rule
      DROP CONSTRAINT IF EXISTS security_rule_policy_fk,
      DROP COLUMN IF EXISTS policy_id;
  `);
}
