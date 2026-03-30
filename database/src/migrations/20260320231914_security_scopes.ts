import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SIMSBIOHUB-914: Normalized security scope tables
    -- Derived tables: no audit columns, no triggers, no soft-delete.
    -- These tables are recomputable from operational data (policy_statement,
    -- team_policy). They are a normalized cache — not a source of truth.
    -- Hard-delete semantics: rows are dropped and re-derived on mutation.
    --------------------------------------------------------------------------------

    CREATE TABLE security_scope (
      security_scope_id UUID DEFAULT gen_random_uuid(),
      scope_hash VARCHAR(255) NOT NULL,
      CONSTRAINT security_scope_pk PRIMARY KEY (security_scope_id)
    );

    CREATE UNIQUE INDEX security_scope_uk1 ON security_scope(scope_hash);

    COMMENT ON TABLE security_scope IS 'Canonical structural access definition derived from a policy statement URN. Deduplicated by scope_hash — same URN always maps to the same scope, regardless of which policy defined it.';
    COMMENT ON COLUMN security_scope.security_scope_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_scope.scope_hash IS 'SHA-256 hex of the normalized URN string. Used for deduplication — two policy statements with the same URN share one scope.';

    --------------------------------------------------------------------------------
    -- POLICY_STATEMENT_SCOPE
    --------------------------------------------------------------------------------

    CREATE TABLE policy_statement_scope (
      policy_statement_scope_id UUID DEFAULT gen_random_uuid(),
      policy_statement_id UUID NOT NULL,
      security_scope_id UUID NOT NULL,
      CONSTRAINT policy_statement_scope_pk PRIMARY KEY (policy_statement_scope_id),
      CONSTRAINT policy_statement_scope_fk1 FOREIGN KEY (policy_statement_id) REFERENCES policy_statement(policy_statement_id),
      CONSTRAINT policy_statement_scope_fk2 FOREIGN KEY (security_scope_id) REFERENCES security_scope(security_scope_id)
    );

    CREATE UNIQUE INDEX policy_statement_scope_uk1 ON policy_statement_scope(policy_statement_id);

    COMMENT ON TABLE policy_statement_scope IS 'Maps each policy statement to its security scope. One statement = one scope. Multiple statements can share the same scope.';
    COMMENT ON COLUMN policy_statement_scope.policy_statement_scope_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN policy_statement_scope.policy_statement_id IS 'Foreign key to the policy_statement table. Unique — each statement maps to exactly one scope.';
    COMMENT ON COLUMN policy_statement_scope.security_scope_id IS 'Foreign key to the security_scope table.';

    --------------------------------------------------------------------------------
    -- SECURITY_SCOPE_ANCHOR
    --------------------------------------------------------------------------------

    CREATE TABLE security_scope_anchor (
      security_scope_anchor_id UUID DEFAULT gen_random_uuid(),
      security_scope_id UUID NOT NULL,
      anchor_submission_feature_id INTEGER NOT NULL,
      CONSTRAINT security_scope_anchor_pk PRIMARY KEY (security_scope_anchor_id),
      CONSTRAINT security_scope_anchor_fk1 FOREIGN KEY (security_scope_id) REFERENCES security_scope(security_scope_id),
      CONSTRAINT security_scope_anchor_fk2 FOREIGN KEY (anchor_submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    CREATE UNIQUE INDEX security_scope_anchor_uk1 ON security_scope_anchor(security_scope_id, anchor_submission_feature_id);
    CREATE INDEX security_scope_anchor_idx1 ON security_scope_anchor(anchor_submission_feature_id);

    COMMENT ON TABLE security_scope_anchor IS 'Binds a security scope to its anchor features — the top-level nodes of secured subtrees that match the scope URN. Anchors are security roots, not expanded descendants. A wildcard scope anchors at the roots; the walk-up search strategy checks from candidates up to anchors, never expanding down.';
    COMMENT ON COLUMN security_scope_anchor.security_scope_anchor_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN security_scope_anchor.security_scope_id IS 'Foreign key to the security_scope table.';
    COMMENT ON COLUMN security_scope_anchor.anchor_submission_feature_id IS 'Foreign key to the submission_feature table. The root of a secured subtree covered by this scope.';

    --------------------------------------------------------------------------------
    -- TEAM_SECURITY_SCOPE
    --------------------------------------------------------------------------------

    CREATE TABLE team_security_scope (
      team_security_scope_id UUID DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL,
      security_scope_id UUID NOT NULL,
      CONSTRAINT team_security_scope_pk PRIMARY KEY (team_security_scope_id),
      CONSTRAINT team_security_scope_fk1 FOREIGN KEY (team_id) REFERENCES team(team_id),
      CONSTRAINT team_security_scope_fk2 FOREIGN KEY (security_scope_id) REFERENCES security_scope(security_scope_id)
    );

    CREATE UNIQUE INDEX team_security_scope_uk1 ON team_security_scope(team_id, security_scope_id);

    COMMENT ON TABLE team_security_scope IS 'Grants a team access to a security scope. Derived from the team_policy → policy_statement → policy_statement_scope chain. Rebuilt synchronously on policy/team-policy mutations (~30 rows per team at scale).';
    COMMENT ON COLUMN team_security_scope.team_security_scope_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN team_security_scope.team_id IS 'Foreign key to the team table.';
    COMMENT ON COLUMN team_security_scope.security_scope_id IS 'Foreign key to the security_scope table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop tables in reverse dependency order
    DROP TABLE IF EXISTS team_security_scope;
    DROP TABLE IF EXISTS security_scope_anchor;
    DROP TABLE IF EXISTS policy_statement_scope;
    DROP TABLE IF EXISTS security_scope;
  `);
}
