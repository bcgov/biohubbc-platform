import type { Knex } from 'knex';

/**
 * Adds the derived reachability table `submission_feature_closure` and the
 * `rebuild_submission_feature_closure` function that repopulates it for a single upload.
 *
 * The closure is the transitive closure over a submission_feature's parent and property
 * (feature-reference) edges — the "evidence" reach used by search. Content edges
 * (submission_feature_feature) are deliberately EXCLUDED: content is the parent tree reversed, so
 * closing over (parent + content) makes every tree edge bidirectional and the transitive closure
 * becomes the complete same-upload digraph (O(N^2)).
 *
 * Reachability is stored forward only, keyed (source, target), because both consumers probe forward
 * from the row they evaluate: auth walks UP from a candidate feature to its ancestors, and search
 * gathers what a feature reaches (its ancestors + referenced entities) to build that feature's
 * document. Neither performs a "who reaches Y" down-probe, so the composite primary key is the only
 * index; a reverse (target, source) index would serve only a query-time down/rollup probe and can be
 * added if such a consumer is ever introduced.
 *
 * The same table serves authorization as well as search. Every row is part of the evidence/search
 * reach; the subset flagged `is_ancestor = true` is the authorization reach — the edges reachable by
 * a pure-parent (ancestry) path, since security cascades up the parent tree only (not across
 * feature references). Auth consumers read `WHERE is_ancestor`; search reads all rows.
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
      is_ancestor                   boolean NOT NULL,
      CONSTRAINT submission_feature_closure_pk PRIMARY KEY (source_submission_feature_id, target_submission_feature_id),
      CONSTRAINT submission_feature_closure_fk1 FOREIGN KEY (source_submission_feature_id) REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_closure_fk2 FOREIGN KEY (target_submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    ----------------------------------------------------------------------------------------
    -- Indexes
    ----------------------------------------------------------------------------------------

    -- The composite primary key (source_submission_feature_id, target_submission_feature_id) is the
    -- only index. Both consumers probe forward by source — auth walks UP from a candidate to its
    -- ancestors, search gathers what a feature reaches — so the PK's (source, target) ordering serves
    -- them. There is no reverse (target, source) index: nothing performs a "who reaches Y" down-probe.
    -- Add one only if a query-time down/rollup consumer is ever introduced.

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_feature_closure IS 'Derived reachability (transitive-closure) table over submission_feature parent and property (feature-reference) edges — the evidence reach used by search. Content edges (submission_feature_feature) are intentionally excluded: content is the parent tree reversed, so closing over (parent + content) produces the complete same-upload digraph (O(N^2)). It stores every directed (source, target) edge reachable through parent and property edges, so search can replace recursive traversal with an indexed forward probe by source. Reachability is stored forward only; the composite (source, target) primary key is the single index, because both auth and search probe forward by source and nothing performs a who-reaches-Y down-probe. The same table also serves authorization: rows flagged is_ancestor=true are the pure parent-ancestry subset (security cascades up the parent tree only, not across feature references), so auth consumers read WHERE is_ancestor while search reads all rows. The composite (source, target) primary key is the storage choice: reachability is (source, target)-unique by definition, so the natural composite PK saves a surrogate column and an extra index at the projected ~1B-row scale. There is intentionally no feature_type_property_id column: that label is meaningful only on direct property edges and meaningless on composed rows, so typed-traversal queries join back to submission_feature_property_feature. There are intentionally no audit columns and no audit/journal triggers: this is fully-derived data rebuilt wholesale by rebuild_submission_feature_closure and never updated in place, matching the schema''s other derived tables (security_scope_anchor, team_security_scope).';
    COMMENT ON COLUMN submission_feature_closure.source_submission_feature_id IS 'Foreign key to the submission_feature row at the source end of a reachable (source, target) edge.';
    COMMENT ON COLUMN submission_feature_closure.target_submission_feature_id IS 'Foreign key to the submission_feature row at the target end of a reachable (source, target) edge.';
    COMMENT ON COLUMN submission_feature_closure.is_ancestor IS 'True when the target is reachable from the source by a pure parent-edge (ancestry) path. The is_ancestor=true subset is the authorization reach (security cascades up the parent tree only); all rows together are the evidence/search reach. Self-loops are ancestry (true); an edge reachable only through a feature-reference (property) edge is false; an edge reachable both ways is true.';

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
      -- Closure = reachability over parent and property (feature-reference) edges — the "evidence"
      -- reach used by search. Content edges (submission_feature_feature) are deliberately EXCLUDED:
      -- content is the parent tree reversed, so closing over (parent + content) makes every tree edge
      -- bidirectional and the transitive closure becomes the complete same-upload digraph (O(N^2)).
      -- Reachability is stored forward only (source -> target): both auth (walk UP from a candidate to
      -- its ancestors) and search (gather what a feature reaches) probe by source, so there is no
      -- reverse index and no stored down direction. Intra-upload only
      -- (cross-upload edges are silently dropped, matching the feature-property indexing engine's
      -- resolution rule); self-loops are included; DELETE-then-INSERT in one txn makes the rebuild
      -- idempotent under retry; UNION (not UNION ALL) in the recursive CTE terminates cycles
      -- (property edges may cycle) and dedupes multi-path edges.
      --
      -- The same rebuild serves authorization too. is_ancestor marks the pure parent-ancestry subset
      -- (security cascades up the parent tree only, not across references). We compute TWO closures:
      -- the ancestry closure (parent-only, transitive) and the evidence closure (parent + property,
      -- transitive; a superset). Every evidence edge is stored; is_ancestor is true iff that edge is
      -- also in the ancestry closure. Auth reads WHERE is_ancestor; search reads all rows.

      -- Scope the rebuild to features that belong to the target upload. DELETE precedes INSERT inside
      -- the function's implicit transaction so the rebuild is idempotent under retry. Source-only is
      -- sufficient: every closure row has BOTH endpoints in one upload (the edge CTEs below join
      -- af_src AND af_tgt to active_features), so matching by source already identifies all of the
      -- upload's rows. sf is upload-wide (not active-only), so a deactivated feature's stale rows are
      -- swept too. Source-only uses the primary key — no reverse index needed.
      DELETE FROM biohub.submission_feature_closure c
      USING biohub.submission_feature sf
      WHERE sf.submission_upload_id = p_submission_upload_id
        AND c.source_submission_feature_id = sf.submission_feature_id;

      WITH RECURSIVE
      -- Active features in the upload (the universe for self-loops and the join filter).
      active_features AS (
        SELECT submission_feature_id
        FROM biohub.submission_feature
        WHERE submission_upload_id = p_submission_upload_id
          AND record_end_date IS NULL
      ),
      -- Reflexive self-loops (every active feature reaches itself) — the reflexive edges that seed the
      -- closure. (A self-loop is the graph term for an X -> X edge; the parent / property edges below
      -- link two distinct features.)
      self_loops AS (
        SELECT submission_feature_id AS source, submission_feature_id AS target FROM active_features
      ),
      -- Direct edges — parent (child -> parent, "up") / property (feature reference) — each filtered
      -- so BOTH endpoints are intra-upload active features. NOTE: content edges
      -- (submission_feature_feature) are intentionally NOT included here; see the header comment for
      -- the O(N^2) rationale.
      parent_edges AS (
        SELECT child.submission_feature_id AS source, child.parent_submission_feature_id AS target
        FROM biohub.submission_feature child
        JOIN active_features af_src ON af_src.submission_feature_id = child.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL
      ),
      property_edges AS (
        SELECT pf.submission_feature_id AS source, pf.referenced_submission_feature_id AS target
        FROM biohub.submission_feature_property_feature pf
        JOIN active_features af_src ON af_src.submission_feature_id = pf.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = pf.referenced_submission_feature_id
      ),
      -- Ancestry base: self + parent only (the authorization reach, before transitive closure).
      ancestry_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
      ),
      -- Evidence base: self + parent + property (the search reach). UNION ALL because dedupe happens
      -- in the recursive CTEs below.
      direct_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
        UNION ALL SELECT source, target FROM property_edges
      ),
      -- Ancestry closure: transitive reachability over parent only. Acyclic up-tree, so it terminates
      -- at tree depth. These edges are the authorization reach (flagged is_ancestor = true below).
      ancestry_closure AS (
        SELECT source, target FROM ancestry_edges
        UNION
        SELECT c.source, d.target
        FROM ancestry_closure c
        JOIN ancestry_edges d ON d.source = c.target
      ),
      -- Evidence closure: transitive reachability over parent + property (the search reach; a superset
      -- of the ancestry closure). UNION (not UNION ALL) dedupes multi-path edges and terminates on
      -- cycles in the property-reference graph (submission_feature_property_feature is not
      -- cycle-prevented at the schema level).
      closure AS (
        SELECT source, target FROM direct_edges
        UNION
        SELECT c.source, d.target
        FROM closure c
        JOIN direct_edges d ON d.source = c.target
      )
      -- Store every evidence edge; is_ancestor is true iff that edge is also a pure parent-ancestry
      -- edge (present in the ancestry closure).
      INSERT INTO biohub.submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      SELECT cl.source, cl.target, (anc.source IS NOT NULL) AS is_ancestor
      FROM closure cl
      LEFT JOIN ancestry_closure anc
        ON anc.source = cl.source AND anc.target = cl.target;

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
