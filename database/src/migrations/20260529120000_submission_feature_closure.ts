import type { Knex } from 'knex';

/**
 * Adds the derived reachability table `submission_feature_closure` and the
 * `rebuild_submission_feature_closure` function that repopulates it for a single upload.
 *
 * The closure is the transitive closure over a submission_feature's parent, content, and
 * property edges, letting search replace recursive traversal with two indexed probes.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Create table
    ----------------------------------------------------------------------------------------

    -- No audit columns and no audit/journal triggers: this is fully-derived data, rebuilt
    -- wholesale (DELETE + INSERT) by rebuild_submission_feature_closure and never updated in
    -- place. Audit columns would carry no information (create_user is always the system user,
    -- update_date/update_user/revision_count are never set) and the journal trigger would double
    -- every write at the projected ~1B-row scale. This matches the schema's other derived tables
    -- (security_scope_anchor, team_security_scope), which also omit audit columns and triggers.
    CREATE TABLE submission_feature_closure (
      source_submission_feature_id  integer NOT NULL,
      target_submission_feature_id  integer NOT NULL,
      CONSTRAINT submission_feature_closure_pk PRIMARY KEY (source_submission_feature_id, target_submission_feature_id),
      CONSTRAINT submission_feature_closure_fk1 FOREIGN KEY (source_submission_feature_id) REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_closure_fk2 FOREIGN KEY (target_submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    ----------------------------------------------------------------------------------------
    -- Create indexes
    ----------------------------------------------------------------------------------------

    -- The composite PK already serves the (source, target) probe; this index serves the reverse (target, source) probe.
    CREATE INDEX submission_feature_closure_target_source_idx
      ON submission_feature_closure (target_submission_feature_id, source_submission_feature_id);

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_feature_closure IS 'Derived reachability (transitive-closure) table over submission_feature parent, content, and property edges. It stores every directed (source, target) pair reachable through any combination of those edges, so search can replace recursive traversal with two indexed probes. The composite (source, target) primary key is the storage choice: reachability is (source, target)-unique by definition, so the natural composite PK saves a surrogate column and an extra index at the projected ~1B-row scale. There is intentionally no feature_type_property_id column: that label is meaningful only on direct property edges and meaningless on composed rows, so typed-traversal queries join back to submission_feature_property_feature. There are intentionally no audit columns and no audit/journal triggers: this is fully-derived data rebuilt wholesale by rebuild_submission_feature_closure and never updated in place, matching the schema''s other derived tables (security_scope_anchor, team_security_scope).';
    COMMENT ON COLUMN submission_feature_closure.source_submission_feature_id IS 'Foreign key to the submission_feature row at the source end of a reachable (source, target) pair.';
    COMMENT ON COLUMN submission_feature_closure.target_submission_feature_id IS 'Foreign key to the submission_feature row at the target end of a reachable (source, target) pair.';

    ----------------------------------------------------------------------------------------
    -- Rebuild function
    ----------------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION biohub.rebuild_submission_feature_closure(p_submission_upload_id uuid)
    RETURNS integer
    LANGUAGE plpgsql
    VOLATILE
    AS $$
    DECLARE
      v_inserted_count integer;
    BEGIN
      -- Closure = reachability over parent, content, and property edges; intra-upload only
      -- (cross-upload edges are silently dropped, matching the feature-property indexing
      -- engine's resolution rule); self rows are included; DELETE-then-INSERT in one txn makes
      -- the rebuild idempotent under retry; UNION (not UNION ALL) in the recursive CTE
      -- terminates 3-cycles and dedupes multi-path pairs.

      -- Scope the rebuild to features that belong to the target upload.
      -- DELETE precedes INSERT inside the function's implicit transaction so the rebuild is idempotent under retry.
      DELETE FROM biohub.submission_feature_closure c
      USING biohub.submission_feature sf
      WHERE sf.submission_upload_id = p_submission_upload_id
        AND (c.source_submission_feature_id = sf.submission_feature_id
          OR c.target_submission_feature_id = sf.submission_feature_id);

      WITH RECURSIVE
      -- Active features in the upload (the universe for self rows and the join filter).
      active_features AS (
        SELECT submission_feature_id
        FROM biohub.submission_feature
        WHERE submission_upload_id = p_submission_upload_id
          AND record_end_date IS NULL
      ),
      -- Self rows.
      self_edges AS (
        SELECT submission_feature_id AS source, submission_feature_id AS target FROM active_features
      ),
      -- Direct edges — parent / content / property — each filtered so BOTH endpoints are intra-upload active features.
      parent_edges AS (
        SELECT child.submission_feature_id AS source, child.parent_submission_feature_id AS target
        FROM biohub.submission_feature child
        JOIN active_features af_src ON af_src.submission_feature_id = child.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL
      ),
      content_edges AS (
        SELECT ff.source_feature_id AS source, ff.target_feature_id AS target
        FROM biohub.submission_feature_feature ff
        JOIN active_features af_src ON af_src.submission_feature_id = ff.source_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = ff.target_feature_id
      ),
      property_edges AS (
        SELECT pf.submission_feature_id AS source, pf.referenced_submission_feature_id AS target
        FROM biohub.submission_feature_property_feature pf
        JOIN active_features af_src ON af_src.submission_feature_id = pf.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = pf.referenced_submission_feature_id
      ),
      -- Direct edges union (UNION ALL because dedupe happens in the recursive CTE below).
      direct_edges AS (
        SELECT source, target FROM self_edges
        UNION ALL SELECT source, target FROM parent_edges
        UNION ALL SELECT source, target FROM content_edges
        UNION ALL SELECT source, target FROM property_edges
      ),
      -- Reachability. UNION (not UNION ALL) dedupes across multiple paths to the same (source, target)
      -- and terminates on cycles in submission_feature_feature (3-cycles are not prevented at the schema level).
      closure AS (
        SELECT source, target FROM direct_edges
        UNION
        SELECT c.source, d.target
        FROM closure c
        JOIN direct_edges d ON d.source = c.target
      )
      INSERT INTO biohub.submission_feature_closure (source_submission_feature_id, target_submission_feature_id)
      SELECT source, target FROM closure;

      GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
      RETURN v_inserted_count;
    END;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Drop rebuild function
    ----------------------------------------------------------------------------------------

    DROP FUNCTION IF EXISTS biohub.rebuild_submission_feature_closure(uuid);

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------

    DROP TABLE IF EXISTS submission_feature_closure;
  `);
}
