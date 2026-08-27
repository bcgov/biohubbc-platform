import type { Knex } from 'knex';

/**
 * Adds the tile context table, which holds the server-side authorization state behind a map tile
 * session.
 *
 * The tile token the browser carries holds only an opaque context id. Everything that decides what a
 * tile may contain — the persisted search expression and the caller's identity — lives here,
 * server-side, and is resolved by `biohub.martin_search` at serve time. A client therefore cannot
 * widen its own access by editing a token: the id resolves to a row it does not control.
 *
 * Nothing about the result set is stored. A context references the search by `expression_id`
 * (`NULL` = unfiltered browse-all), and the tile function evaluates that expression, and the user's
 * live authorization, per candidate inside each tile envelope. This is what lets a search of any
 * size be mapped: per-tile cost scales with the envelope, never with the result set.
 *
 * `system_user_id` is `NULL` for anonymous callers, mirroring exactly the two identities the search
 * read paths can resolve — feature search has no unfiltered/administrator branch, and the map must
 * show exactly what the table view shows.
 *
 * Rows are created by the mint endpoint, expire at `record_end_date`, and are deleted wholesale by a
 * scheduled job. `create_date`/`create_user` record provenance; there are no update columns or
 * journal triggers because a context row is never updated in place.
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

    CREATE TABLE martin_context (
      martin_context_id    uuid           DEFAULT public.gen_random_uuid() NOT NULL,
      context_hash         varchar(64)    NOT NULL,
      expression_id        uuid,
      feature_type_id      integer        NOT NULL,
      system_user_id       integer,
      record_end_date      timestamptz(6) NOT NULL,
      create_date          timestamptz(6) DEFAULT now() NOT NULL,
      create_user          integer        NOT NULL,
      CONSTRAINT martin_context_pk PRIMARY KEY (martin_context_id),
      CONSTRAINT martin_context_fk1 FOREIGN KEY (feature_type_id) REFERENCES feature_type(feature_type_id),
      CONSTRAINT martin_context_fk2 FOREIGN KEY (expression_id) REFERENCES expression(expression_id),
      CONSTRAINT martin_context_fk3 FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    ----------------------------------------------------------------------------------------
    -- Indexes
    ----------------------------------------------------------------------------------------

    -- Serves the reuse lookup on the mint path, which reads the newest qualifying row for a hash.
    --
    -- Deliberately NOT unique. A "unique among live rows" partial index is impossible here because
    -- the liveness predicate depends on now(), which is not immutable. Uniqueness among live
    -- contexts is instead upheld by the mint path, which reads and inserts in one statement behind
    -- an advisory lock keyed on the hash.
    CREATE INDEX martin_context_idx1 ON martin_context(context_hash);

    -- Serves the expiry sweep and the live-context cap's eviction ordering.
    CREATE INDEX martin_context_idx2 ON martin_context(record_end_date);

    ----------------------------------------------------------------------------------------
    -- Comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE  martin_context                             IS 'Server-side authorization state for a map Martin session. Referenced by opaque id from a tile token; the persisted expression and the caller''s live authorization are evaluated by biohub.martin_search at serve time. Short-lived; rows are never updated in place.';
    COMMENT ON COLUMN martin_context.martin_context_id           IS 'Opaque identifier. The only part of this row a client ever sees.';
    COMMENT ON COLUMN martin_context.context_hash                IS 'Hash of (expression id, feature type, system user). Lets an identical request reuse a live context, which is what makes tile caching effective.';
    COMMENT ON COLUMN martin_context.expression_id               IS 'Persisted normalized search expression, or NULL for an unfiltered browse-all session. Evaluated per candidate at serve time.';
    COMMENT ON COLUMN martin_context.feature_type_id             IS 'Feature type the session searched. Always applied when generating tiles.';
    COMMENT ON COLUMN martin_context.system_user_id              IS 'Caller whose live authorization applies, or NULL for anonymous. The tile function re-resolves team membership on every tile, so revoking access takes effect immediately.';
    COMMENT ON COLUMN martin_context.record_end_date             IS 'Context expiry. Enforced at serve time: an expired context generates no tiles, whatever the token says.';
    COMMENT ON COLUMN martin_context.create_date                 IS 'Row creation timestamp.';
    COMMENT ON COLUMN martin_context.create_user                 IS 'User that created the context: the searcher when authenticated, the API service account for anonymous mints.';
  `);
}

/**
 * Drops the tile context table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS martin_context;
  `);
}
