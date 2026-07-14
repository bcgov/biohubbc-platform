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
 * Reachability is stored forward only, keyed (source, target). Auth probes forward from the row it
 * evaluates: it walks UP from a candidate feature to its ancestors, so the PK's (source, target)
 * ordering serves it. Expression search probes BOTH directions: forward by source to gather what an
 * evidence feature reaches (its ancestors + referenced entities), and reverse by target to gather the
 * features that reach an evidence feature (its descendants + referencing entities). The reverse probe
 * is required because search lets the result feature type differ from the filtered one — a
 * "filter the container, return the contained" search (e.g. filter dataset.name, return its
 * sample_sites) resolves DESCENDANTS of the evidence, which is a down-probe. The data already holds
 * those rows (a descendant reaches its ancestor, so the (descendant, ancestor) row exists); only the
 * index was missing, so a secondary (target, source) index is added to serve the down-probe.
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

    -- Two indexes, one per probe direction:
    --   1. The composite primary key (source, target) serves the FORWARD probe by source — auth walks
    --      UP from a candidate to its ancestors, and search gathers what an evidence feature reaches.
    --   2. The secondary (target, source) index serves search's REVERSE probe by target — gathering the
    --      features that reach an evidence feature (its descendants + referencing entities). Expression
    --      search needs this because the result feature type can differ from the filtered one: a
    --      "filter the container, return the contained" search resolves DESCENDANTS of the evidence,
    --      which is a down-probe. Column order (target, source) mirrors the PK so the down-probe is
    --      index-only (it returns source without a heap fetch).
    CREATE INDEX submission_feature_closure_idx1 ON submission_feature_closure (target_submission_feature_id, source_submission_feature_id);

    ----------------------------------------------------------------------------------------
    -- Table and column comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE submission_feature_closure IS 'Derived reachability (transitive-closure) table over submission_feature parent and property (feature-reference) edges — the evidence reach used by search. Content edges (submission_feature_feature) are intentionally excluded: content is the parent tree reversed, so closing over (parent + content) produces the complete same-upload digraph (O(N^2)). It stores every directed (source, target) edge reachable through parent and property edges, so search can replace recursive traversal with indexed probes. Auth probes forward by source (an ancestor walk). Expression search probes both directions, because its result feature type can differ from the filtered one: forward by source resolves what an evidence feature reaches (its ancestors + referenced entities), and reverse by target resolves what reaches an evidence feature (its descendants + referencing entities — a filter-the-container/return-the-contained search). The composite (source, target) primary key serves the forward probe; a secondary (target, source) index (submission_feature_closure_idx1) serves the reverse down-probe and, mirroring the PK column order, keeps it index-only. The same table also serves authorization: rows flagged is_ancestor=true are the pure parent-ancestry subset (security cascades up the parent tree only, not across feature references), so auth consumers read WHERE is_ancestor while search reads all rows. The composite (source, target) primary key is a deliberate deviation from the schema''s usual surrogate <table>_id key: reachability is (source, target)-unique by definition, so making the natural key the primary key avoids a surrogate column AND the extra index a surrogate PK would force — a (source, target) unique index would still be required for uniqueness and the forward probe, so the surrogate would only add a redundant index that serves no probe — dead weight at the projected ~1B-row scale. The surrogate would carry no benefit here: nothing references this leaf table by a single-column id, and rows are never updated in place (they are rebuilt wholesale per upload). There is intentionally no feature_type_property_id column: that label is meaningful only on direct property edges and meaningless on composed rows, so typed-traversal queries join back to submission_feature_property_feature. There are intentionally no audit columns and no audit/journal triggers: this is fully-derived data recomputed wholesale per upload (DELETE + INSERT) by the application and never updated in place. The sibling derived tables (security_scope_anchor, team_security_scope) likewise omit audit columns, but they keep a surrogate primary key; this table drops the surrogate as well (see the composite-key note above).';
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
