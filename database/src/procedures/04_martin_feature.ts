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
 * Create the single-feature spatial property vector tile function.
 *
 * Unlike biohub.martin_search, which resolves an opaque context id to a stored access class and
 * re-applies the feature security predicate on every tile, this source is authorized entirely at mint
 * time. The context string is not a lookup key: it carries the two identifiers directly, and it is
 * trustworthy because the gateway only forwards the `ctx` claim of a signed token it has verified. A
 * client that edits the identifiers it sent to the mint endpoint gets a token scoped to whatever the
 * mint endpoint authorized it for, which is the same closure-based check the feature detail page runs.
 *
 * Serve time security is deliberately weaker here than for search, because there is nothing left to
 * protect: `GET /api/submission/{id}/features/{id}/properties` already returns these geometry values in
 * full to any caller that passes the same authorization. The exposure a stale token buys is one
 * feature's geometry for the remainder of the token TTL, on a page that was authorized when the token
 * was issued. Search is different — a context there is a standing query over the whole corpus, so it
 * must re-check.
 *
 * What is still enforced here is the shape of the request rather than the identity of the caller: the
 * feature must belong to the submission named in the same token, and it must still be active. Both are
 * join conditions below, so a token minted before a feature was end-dated stops producing tiles.
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
    -- Tile function (the Martin function source)
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_feature(z integer, x integer, y integer, query_params json)
    RETURNS bytea
    LANGUAGE plpgsql
    STABLE
    PARALLEL SAFE
    SECURITY DEFINER
    SET search_path = biohub, public, pg_temp
    AS $fn$
    DECLARE
      -- Tunables. Changing either alters tile output for identical inputs, so bump
      -- MARTIN_SOURCE_VERSION on the gateway at the same time to invalidate cached tiles.
      c_extent constant integer := 4096;
      c_buffer constant integer := 64;

      v_context_text          text;
      v_submission_id         integer;
      v_submission_feature_id integer;
      v_env_3857              public.geometry;
      v_env_4326              public.geometry;
      v_mvt                   bytea;
    BEGIN
      -- The gateway strips every client supplied parameter and injects only this one, taken from the
      -- verified token. The function still treats it as untrusted: anything unparseable yields an
      -- empty tile rather than an error, so a probing client learns nothing from the difference.
      v_context_text := query_params ->> 'context';

      IF v_context_text IS NULL OR v_context_text !~ '^sf:[0-9]{1,10}:[0-9]{1,10}$' THEN
        RETURN NULL;
      END IF;

      BEGIN
        v_submission_id         := split_part(v_context_text, ':', 2)::integer;
        v_submission_feature_id := split_part(v_context_text, ':', 3)::integer;
      EXCEPTION
        -- The pattern above bounds the digit count, not the magnitude, so a ten digit value can still
        -- overflow integer.
        WHEN numeric_value_out_of_range THEN
          RETURN NULL;
      END;

      v_env_3857 := public.ST_TileEnvelope(z, x, y);
      -- Geometry is stored in WGS84, so the envelope is transformed to match rather than
      -- transforming every candidate geometry, which would make the index unusable.
      v_env_4326 := public.ST_Transform(v_env_3857, 4326);

      -- 'mvt_feature_id' becomes the MVT feature id (5th ST_AsMVT argument): PostGIS consumes that
      -- column as the id and drops it from the attributes, so the geometry id is selected twice —
      -- once for the id, once as a plain property. A stable id lets MapLibre treat the fragments of
      -- one geometry (split across tile boundaries) as the same thing.
      SELECT public.ST_AsMVT(feature_rows.*, 'geometries', c_extent, 'geom', 'mvt_feature_id')
      INTO v_mvt
      FROM (
        SELECT
          public.ST_AsMVTGeom(
            public.ST_Transform(g.value, 3857),
            v_env_3857,
            c_extent,
            c_buffer,
            true
          ) AS geom,
          g.submission_feature_property_geometry_id AS mvt_feature_id,
          -- Enough to tell one spatial property from another in a legend or a popup, and nothing
          -- else. Attribute level security stays in the API.
          g.submission_feature_property_geometry_id,
          g.feature_type_property_id,
          fp.display_name AS property_display_name,
          fp.name AS property_name
        FROM biohub.submission_feature_property_geometry g
        JOIN biohub.submission_feature sf
          ON sf.submission_feature_id = g.submission_feature_id
          -- The submission is part of the token, so a token cannot be replayed against a feature id
          -- that belongs to a different submission than the one that was authorized.
          AND sf.submission_id = v_submission_id
          AND sf.record_effective_date <= now()
          AND (sf.record_end_date IS NULL OR now() < sf.record_end_date)
        -- The property catalog join is what makes a geometry row nameable. Guarding on
        -- feature_type_id as well as feature_type_property_id mirrors the equivalent query in
        -- api/src/repositories/submission-feature-property-repository.ts, so the map and the
        -- properties table label the same geometry the same way.
        JOIN biohub.feature_type_property ftp
          ON ftp.feature_type_property_id = g.feature_type_property_id
          AND ftp.feature_type_id = sf.feature_type_id
          AND ftp.record_end_date IS NULL
        JOIN biohub.feature_property fp
          ON fp.feature_property_id = ftp.feature_property_id
          AND fp.record_end_date IS NULL
        -- Equality on submission_feature_id first: this is the condition
        -- submission_feature_property_geometry_idx1 serves, and one feature's geometries are few
        -- enough that filtering them by envelope afterwards costs nothing.
        WHERE g.submission_feature_id = v_submission_feature_id
          AND g.value && v_env_4326
      ) feature_rows
      WHERE feature_rows.geom IS NOT NULL;

      -- ST_AsMVT returns a zero length bytea (NOT NULL) when nothing matches. Normalize that to NULL
      -- so Martin serves an unambiguous empty tile (204) rather than a 0 byte body.
      RETURN NULLIF(v_mvt, ''::bytea);
    END
    $fn$;

    -- Martin parses the function comment as TileJSON metadata and logs a warning if it is not valid
    -- JSON, so the description is provided as a TileJSON fragment rather than prose.
    COMMENT ON FUNCTION biohub.martin_feature(integer, integer, integer, json) IS
      '{"description": "Spatial property vector tiles for a single submission feature. The submission and feature identifiers are carried by the verified token, and the submission to feature relationship is re-checked here."}';

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
      REVOKE ALL ON FUNCTION biohub.martin_feature(integer, integer, integer, json) FROM PUBLIC;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_martin_role) THEN
        -- The tile function only. The martin role gets no table privileges.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_feature(integer, integer, integer, json) TO %I', v_martin_role);
      ELSE
        RAISE WARNING 'Role % does not exist, skipping martin_feature grant.', v_martin_role;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_api_role) THEN
        -- The API role needs EXECUTE so the integration tests can exercise the tile SQL directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_feature(integer, integer, integer, json) TO %I', v_api_role);
      END IF;
    END
    $grants$;
  `);
}
