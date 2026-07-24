import { Knex } from 'knex';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';
const DB_USER_API = process.env.DB_USER_API || 'biohub_api';

/**
 * Escape a value for embedding as a SQL string literal inside the dollar-quoted DO block below.
 *
 * @param {string} value
 * @return {*}  {string}
 */
const escapeLiteral = (value: string): string => value.replace(/'/g, `''`);

/**
 * Create the authorized search-result vector tile function.
 *
 * This is where data visibility is enforced. The tile gateway only authenticates: it proves a request
 * carries a valid token and forwards the opaque context id. What that context is allowed to see is
 * decided here, in SQL, every time a tile is generated.
 *
 * Two properties follow from evaluating security at serve time rather than at mint time:
 *
 * 1. Securing a feature removes it from newly generated tiles immediately. The exposure window is the
 *    gateway's tile cache TTL, not the token or context lifetime.
 * 2. A client cannot widen its own access. The only input it influences is an opaque id, which
 *    resolves to a server-side row holding the access class and the scopes captured at mint time.
 *
 * The security predicate is a direct port of `isEffectivelySecured` / `isAccessibleToUser` in
 * `api/src/repositories/sql-fragments.ts`, with one deliberate change: the branch that walks
 * team_security_scope -> team -> team_member is replaced by a test against the scope ids stored on
 * the context. User identity must never reach the tile path, and the stored set is the snapshot of
 * exactly what that join would have returned at mint time. Keeping the rest byte-for-byte identical
 * — including `status = 'active'` and the fail-closed missing-self-loop probe — is what stops the map
 * and the table view from ever disagreeing.
 *
 * SECURITY DEFINER with a pinned search_path: the function is owned by the migration role, which can
 * read the underlying tables, so the `martin` role needs EXECUTE on this function and nothing else —
 * no table privileges at all. The pinned search_path prevents an attacker-controlled path from
 * resolving these table names elsewhere.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Visible geometry resolver
    --
    -- The single place the security predicate is written. Both zoom branches of tile_search call
    -- this, so the raw feature view and the aggregated view can never diverge in what they expose.
    --
    -- Not granted to the martin role. It is only ever reached from tile_search, which is SECURITY
    -- DEFINER, so it executes with the definer's privileges there.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.tile_search_visible_geometries(
      p_tile_context_id  uuid,
      p_is_materialized  boolean,
      p_feature_type_id  integer,
      p_access_class     text,
      p_scope_ids        uuid[],
      p_envelope_4326    public.geometry
    )
    RETURNS TABLE (
      submission_feature_id integer,
      submission_id         integer,
      is_secured            boolean,
      geometry_4326         public.geometry
    )
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    AS $fn$
      SELECT
        sf.submission_feature_id,
        sf.submission_id,
        secured.is_secured,
        g.value AS geometry_4326
      FROM biohub.submission_feature_property_geometry g
      JOIN biohub.submission_feature sf
        ON sf.submission_feature_id = g.submission_feature_id
      -- Evaluated once per candidate and reused for both the visibility test and the emitted
      -- property, so a feature can never be filtered as unsecured yet labelled secured.
      CROSS JOIN LATERAL (
        SELECT (
          EXISTS (
            SELECT 1
            FROM biohub.submission_feature_closure c
            JOIN biohub.submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
            JOIN biohub.submission_feature sf_sec ON sf_sec.submission_feature_id = c.target_submission_feature_id
            WHERE c.source_submission_feature_id = sf.submission_feature_id
              AND c.is_ancestor = true
              AND sfs.record_end_date IS NULL
              AND sfs.status = 'active'
              AND sf_sec.record_effective_date <= now()
              AND (sf_sec.record_end_date IS NULL OR now() < sf_sec.record_end_date)
          )
          -- Fail closed. The reflexive self-loop (F, F) exists for every feature whose closure has
          -- been built; its absence means the closure is missing, so we cannot prove the feature is
          -- unsecured and must not leak it.
          OR NOT EXISTS (
            SELECT 1
            FROM biohub.submission_feature_closure c
            WHERE c.source_submission_feature_id = sf.submission_feature_id
              AND c.target_submission_feature_id = sf.submission_feature_id
          )
        ) AS is_secured
      ) secured
      -- Bounding box first: this is the condition the GIST index on
      -- submission_feature_property_geometry(value) serves, and it is what keeps a tile from
      -- scanning the whole table.
      WHERE g.value && p_envelope_4326
        AND sf.feature_type_id = p_feature_type_id
        AND sf.record_effective_date <= now()
        AND (sf.record_end_date IS NULL OR now() < sf.record_end_date)
        -- Filtered searches restrict to the materialized result set; browse-all sessions are
        -- rule-based and match on the security predicate alone.
        AND (
          NOT p_is_materialized
          OR EXISTS (
            SELECT 1
            FROM biohub.tile_context_feature tcf
            WHERE tcf.tile_context_id = p_tile_context_id
              AND tcf.submission_feature_id = sf.submission_feature_id
          )
        )
        AND (
          NOT secured.is_secured
          OR (
            p_access_class = 'scoped'
            AND EXISTS (
              SELECT 1
              FROM biohub.submission_feature_closure c
              JOIN biohub.security_scope_anchor ssa
                ON ssa.anchor_submission_feature_id = c.target_submission_feature_id
              WHERE c.source_submission_feature_id = sf.submission_feature_id
                AND c.is_ancestor = true
                AND ssa.security_scope_id = ANY(p_scope_ids)
            )
          )
        );
    $fn$;

    COMMENT ON FUNCTION biohub.tile_search_visible_geometries(uuid, boolean, integer, text, uuid[], public.geometry) IS
      'Resolves the geometries a tile context may see within a bounding box. Ported from isEffectivelySecured/isAccessibleToUser in api/src/repositories/sql-fragments.ts, with the team membership join replaced by the scope ids captured on the context. Called only from biohub.tile_search.';

    ----------------------------------------------------------------------------------------
    -- Tile function (the Martin function source)
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.tile_search(z integer, x integer, y integer, query_params json)
    RETURNS bytea
    LANGUAGE plpgsql
    STABLE
    PARALLEL SAFE
    SECURITY DEFINER
    SET search_path = biohub, public, pg_temp
    AS $fn$
    DECLARE
      -- Tunables. Changing either alters tile output for identical inputs, so bump
      -- TILE_SOURCE_VERSION on the gateway at the same time to invalidate cached tiles.
      c_cluster_below_zoom constant integer := 9;
      c_grid_cells         constant integer := 8;
      c_extent             constant integer := 4096;
      c_buffer             constant integer := 64;

      v_context_text text;
      v_context_id   uuid;
      v_ctx          record;
      v_env_3857     public.geometry;
      v_env_4326     public.geometry;
      v_cell_width   double precision;
      v_cell_height  double precision;
      v_mvt          bytea;
    BEGIN
      -- The gateway strips every client supplied parameter and injects only this one, but the
      -- function still treats it as untrusted: anything unparseable yields an empty tile rather
      -- than an error, so a probing client learns nothing from the difference.
      v_context_text := query_params ->> 'context';

      IF v_context_text IS NULL THEN
        RETURN NULL;
      END IF;

      BEGIN
        v_context_id := v_context_text::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RETURN NULL;
      END;

      -- Expiry is enforced here, not by the token. An expired context stops generating tiles even
      -- if a valid token for it is still in flight.
      SELECT
        tc.tile_context_id,
        tc.access_class,
        tc.feature_type_id,
        tc.security_scope_ids,
        tc.is_materialized
      INTO v_ctx
      FROM biohub.tile_context tc
      WHERE tc.tile_context_id = v_context_id
        AND tc.expires_at > now();

      IF NOT FOUND THEN
        RETURN NULL;
      END IF;

      v_env_3857 := public.ST_TileEnvelope(z, x, y);
      -- Geometry is stored in WGS84, so the envelope is transformed to match rather than
      -- transforming every candidate geometry, which would make the GIST index unusable.
      v_env_4326 := public.ST_Transform(v_env_3857, 4326);

      IF z < c_cluster_below_zoom THEN
        -- Low zoom: emit per-cell counts instead of raw features. This bounds tile size where a
        -- whole province is in view, and avoids handing out a bulk extract of every point.
        v_cell_width  := (public.ST_XMax(v_env_3857) - public.ST_XMin(v_env_3857)) / c_grid_cells;
        v_cell_height := (public.ST_YMax(v_env_3857) - public.ST_YMin(v_env_3857)) / c_grid_cells;

        SELECT public.ST_AsMVT(cluster_rows.*, 'clusters', c_extent, 'geom')
        INTO v_mvt
        FROM (
          SELECT
            public.ST_AsMVTGeom(
              public.ST_Centroid(public.ST_Collect(feature_points.point_3857)),
              v_env_3857,
              c_extent,
              c_buffer,
              true
            ) AS geom,
            count(*)::integer AS count
          FROM (
            -- One point per feature, so a feature with many geometries counts once.
            SELECT
              public.ST_Transform(
                public.ST_Centroid(public.ST_Collect(visible.geometry_4326)),
                3857
              ) AS point_3857
            FROM biohub.tile_search_visible_geometries(
              v_ctx.tile_context_id,
              v_ctx.is_materialized,
              v_ctx.feature_type_id,
              v_ctx.access_class,
              v_ctx.security_scope_ids,
              v_env_4326
            ) visible
            GROUP BY visible.submission_feature_id
          ) feature_points
          GROUP BY public.ST_SnapToGrid(
            feature_points.point_3857,
            public.ST_XMin(v_env_3857),
            public.ST_YMin(v_env_3857),
            v_cell_width,
            v_cell_height
          )
        ) cluster_rows
        WHERE cluster_rows.geom IS NOT NULL;
      ELSE
        SELECT public.ST_AsMVT(feature_rows.*, 'features', c_extent, 'geom')
        INTO v_mvt
        FROM (
          SELECT
            public.ST_AsMVTGeom(
              public.ST_Transform(visible.geometry_4326, 3857),
              v_env_3857,
              c_extent,
              c_buffer,
              true
            ) AS geom,
            -- Identifiers only. Everything needed to render and to navigate to the feature detail
            -- page, and nothing else: attribute level security stays in the API, which is what
            -- serves the popup once a feature is clicked.
            visible.submission_feature_id,
            visible.submission_id,
            visible.is_secured
          FROM biohub.tile_search_visible_geometries(
            v_ctx.tile_context_id,
            v_ctx.is_materialized,
            v_ctx.feature_type_id,
            v_ctx.access_class,
            v_ctx.security_scope_ids,
            v_env_4326
          ) visible
        ) feature_rows
        WHERE feature_rows.geom IS NOT NULL;
      END IF;

      -- ST_AsMVT returns a zero length bytea (NOT NULL) when nothing matches. Normalize that to NULL
      -- so Martin serves an unambiguous empty tile (204) rather than a 0 byte body.
      RETURN NULLIF(v_mvt, ''::bytea);
    END
    $fn$;

    -- Martin parses the function comment as TileJSON metadata and logs a warning if it is not valid
    -- JSON, so the description is provided as a TileJSON fragment rather than prose.
    COMMENT ON FUNCTION biohub.tile_search(integer, integer, integer, json) IS
      '{"description": "Authorized search result vector tiles. Resolves an opaque tile context id to its stored access class and security scopes, and applies the feature security predicate at serve time."}';

    ----------------------------------------------------------------------------------------
    -- Grants
    ----------------------------------------------------------------------------------------
    DO $grants$
    DECLARE
      v_martin_role text := '${escapeLiteral(DB_USER_MARTIN)}';
      v_api_role    text := '${escapeLiteral(DB_USER_API)}';
    BEGIN
      -- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and pg_restore --no-acl restores that
      -- default at cutover, so the revoke is re-applied on every deploy rather than once.
      REVOKE ALL ON FUNCTION biohub.tile_search(integer, integer, integer, json) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.tile_search_visible_geometries(uuid, boolean, integer, text, uuid[], public.geometry) FROM PUBLIC;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_martin_role) THEN
        -- The tile function only. The martin role gets no table privileges and cannot call the
        -- resolver directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.tile_search(integer, integer, integer, json) TO %I', v_martin_role);
      ELSE
        RAISE WARNING 'Role % does not exist, skipping tile_search grant.', v_martin_role;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_api_role) THEN
        -- The API role needs both so the integration tests can exercise the tile SQL directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.tile_search(integer, integer, integer, json) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.tile_search_visible_geometries(uuid, boolean, integer, text, uuid[], public.geometry) TO %I', v_api_role);
      END IF;
    END
    $grants$;
  `);
}
