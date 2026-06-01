import type { Knex } from 'knex';

/**
 * Adds the derived reachability table `submission_feature_closure`. Rows are derived data, recomputed
 * per-upload by the application (SubmissionFeatureClosureRepository.computeClosureForUpload — a wholesale
 * DELETE + recursive-CTE INSERT); this migration owns only the table DDL.
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

    -- No audit columns and no audit/journal triggers: this is fully-derived data, recomputed
    -- wholesale per upload (DELETE + INSERT) by the application and never updated in
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

    COMMENT ON TABLE submission_feature_closure IS 'Derived reachability (transitive-closure) table over submission_feature parent and property (feature-reference) edges — the evidence reach used by search. Content edges (submission_feature_feature) are intentionally excluded: content is the parent tree reversed, so closing over (parent + content) produces the complete same-upload digraph (O(N^2)). It stores every directed (source, target) edge reachable through parent and property edges, so search can replace recursive traversal with an indexed forward probe by source. Reachability is stored forward only; the composite (source, target) primary key is the single index, because both auth and search probe forward by source and nothing performs a who-reaches-Y down-probe. The same table also serves authorization: rows flagged is_ancestor=true are the pure parent-ancestry subset (security cascades up the parent tree only, not across feature references), so auth consumers read WHERE is_ancestor while search reads all rows. The composite (source, target) primary key is the storage choice: reachability is (source, target)-unique by definition, so the natural composite PK saves a surrogate column and an extra index at the projected ~1B-row scale. There is intentionally no feature_type_property_id column: that label is meaningful only on direct property edges and meaningless on composed rows, so typed-traversal queries join back to submission_feature_property_feature. There are intentionally no audit columns and no audit/journal triggers: this is fully-derived data recomputed wholesale per upload (DELETE + INSERT) by the application and never updated in place, matching the schema''s other derived tables (security_scope_anchor, team_security_scope).';
    COMMENT ON COLUMN submission_feature_closure.source_submission_feature_id IS 'Foreign key to the submission_feature row at the source end of a reachable (source, target) edge.';
    COMMENT ON COLUMN submission_feature_closure.target_submission_feature_id IS 'Foreign key to the submission_feature row at the target end of a reachable (source, target) edge.';
    COMMENT ON COLUMN submission_feature_closure.is_ancestor IS 'True when the target is reachable from the source by a pure parent-edge (ancestry) path. The is_ancestor=true subset is the authorization reach (security cascades up the parent tree only); all rows together are the evidence/search reach. Self-loops are ancestry (true); an edge reachable only through a feature-reference (property) edge is false; an edge reachable both ways is true.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Drop tables
    ----------------------------------------------------------------------------------------

    DROP TABLE IF EXISTS submission_feature_closure;
  `);
}
