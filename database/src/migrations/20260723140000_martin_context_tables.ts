import type { Knex } from 'knex';

/**
 * Adds the tile context tables, which hold the server-side authorization state behind a map tile
 * session.
 *
 * The tile token the browser carries holds only an opaque context id. Everything that decides what a
 * tile may contain — the caller's access class, their resolved security scopes, and optionally the
 * materialized set of features their search matched — lives here, server-side, and is resolved by
 * `biohub.martin_search` at serve time. A client therefore cannot widen its own access by editing a
 * token: the id resolves to a row it does not control.
 *
 * Access class is deliberately `anon | scoped` only, mirroring the search paths exactly. Feature
 * search resolves a system user id that is either null (anonymous) or a number; there is no
 * unfiltered/administrator branch on those read paths. The map must show exactly what the table view
 * shows, so an access class the table view cannot produce would be a divergence, not a feature.
 *
 * Both tables are derived, short-lived caches: rows are created by the mint endpoint, expire after a
 * configured TTL, and are deleted wholesale by a scheduled job. They therefore follow the schema's
 * other derived tables (submission_feature_closure, security_scope_anchor, team_security_scope) in
 * omitting audit columns and audit/journal triggers — those would carry no information for rows that
 * are never updated in place, and would double every write.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Create tables
    ----------------------------------------------------------------------------------------

    CREATE TABLE martin_context (
      martin_context_id      uuid          DEFAULT public.gen_random_uuid() NOT NULL,
      context_hash         varchar(64)   NOT NULL,
      access_class         varchar(10)   NOT NULL,
      feature_type_id      integer       NOT NULL,
      security_scope_ids   uuid[]        DEFAULT '{}' NOT NULL,
      expression_hash      varchar(64),
      is_materialized      boolean       NOT NULL,
      bbox                 public.geometry,
      expires_at           timestamptz(6) NOT NULL,
      create_date          timestamptz(6) DEFAULT now() NOT NULL,
      CONSTRAINT martin_context_pk PRIMARY KEY (martin_context_id),
      CONSTRAINT martin_context_ck1 CHECK (access_class IN ('anon', 'scoped')),
      CONSTRAINT martin_context_fk1 FOREIGN KEY (feature_type_id) REFERENCES feature_type(feature_type_id)
    );

    CREATE TABLE martin_context_feature (
      martin_context_id        uuid    NOT NULL,
      submission_feature_id  integer NOT NULL,
      CONSTRAINT martin_context_feature_pk PRIMARY KEY (martin_context_id, submission_feature_id),
      -- ON DELETE CASCADE so expiring a context also drops its materialized ids in one statement.
      CONSTRAINT martin_context_feature_fk1 FOREIGN KEY (martin_context_id) REFERENCES martin_context(martin_context_id) ON DELETE CASCADE,
      CONSTRAINT martin_context_feature_fk2 FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    ----------------------------------------------------------------------------------------
    -- Indexes
    ----------------------------------------------------------------------------------------

    -- Deliberately NOT unique. A "unique among live rows" partial index is impossible here because
    -- the liveness predicate depends on now(), which is not immutable. Two concurrent mints of the
    -- same search can therefore create duplicate live contexts; both are correct, both expire, and
    -- the cleanup job removes them. Reuse picks the newest qualifying row.
    CREATE INDEX martin_context_idx1 ON martin_context(context_hash);

    -- Serves the expiry sweep.
    CREATE INDEX martin_context_idx2 ON martin_context(expires_at);

    ----------------------------------------------------------------------------------------
    -- Comments
    ----------------------------------------------------------------------------------------

    COMMENT ON TABLE  martin_context                          IS 'Server-side authorization state for a map Martin session. Referenced by opaque id from a tile token; resolved at serve time by biohub.martin_search. Short-lived and derived: no audit columns or triggers.';
    COMMENT ON COLUMN martin_context.martin_context_id           IS 'Opaque identifier. The only part of this row a client ever sees.';
    COMMENT ON COLUMN martin_context.context_hash              IS 'Hash of (normalized expression, feature type, access class, sorted scope ids). Lets an identical request reuse a live context, which is what makes anonymous tile caching effective.';
    COMMENT ON COLUMN martin_context.access_class              IS 'anon or scoped. Mirrors the two identities the search paths can resolve; there is deliberately no unfiltered/administrator class.';
    COMMENT ON COLUMN martin_context.feature_type_id           IS 'Feature type the session searched. Always applied when generating tiles.';
    COMMENT ON COLUMN martin_context.security_scope_ids        IS 'Security scopes resolved for the caller at mint time. Stored as an array so the serve-time check is a single = ANY() test rather than a join through team membership: user identity must never reach the tile path.';
    COMMENT ON COLUMN martin_context.expression_hash           IS 'Semantic hash of the normalized search expression, or NULL for an unfiltered browse-all session. Safe to log, unlike the expression itself.';
    COMMENT ON COLUMN martin_context.is_materialized           IS 'True when martin_context_feature holds the matching feature ids. False for browse-all sessions, which are rule-based and never materialized.';
    COMMENT ON COLUMN martin_context.bbox                      IS 'Extent of the matched geometries, used to frame the map on load. NULL for browse-all sessions.';
    COMMENT ON COLUMN martin_context.expires_at                IS 'Enforced at serve time: an expired context generates no tiles, whatever the token says.';
    COMMENT ON COLUMN martin_context.create_date               IS 'Row creation timestamp.';

    COMMENT ON TABLE  martin_context_feature                   IS 'Materialized search results for a tile context. Joined by biohub.martin_search so tiles show exactly the features the same search returned.';
    COMMENT ON COLUMN martin_context_feature.martin_context_id   IS 'Owning tile context. Cascades on delete.';
    COMMENT ON COLUMN martin_context_feature.submission_feature_id IS 'A feature the search matched. Capped at mint time; an over-cap search is refused rather than silently truncated.';
  `);
}

/**
 * Drops the tile context tables.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS martin_context_feature;
    DROP TABLE IF EXISTS martin_context;
  `);
}
