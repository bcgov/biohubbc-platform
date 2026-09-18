import { Knex } from 'knex';
import { escapeLiteral } from '../utils/migrations';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';
const DB_USER_API = process.env.DB_USER_API || 'biohub_api';

/**
 * Create the submission-upload spatial property vector tile function.
 *
 * Draws every spatial property of every ACTIVE submission feature that belongs to one submission
 * upload, for the administrative upload review map. It follows the `biohub.martin_feature` design
 * rather than the `biohub.martin_search` one: the context string is not a lookup key, it carries the
 * submission id and the upload id directly, and it is trustworthy because the gateway only forwards
 * the `ctx` claim of a signed token it has verified. The mint endpoint is restricted to system
 * administrators and re-checks that the upload belongs to the submission before issuing a token, so
 * a client cannot widen a token by editing what it sends.
 *
 * Serve time security is deliberately weaker than for search because there is nothing left to
 * protect: an administrator can already read every one of these geometries in full through
 * `GET /api/administrative/submission/{id}/upload/{id}/features/{id}/properties`. What is still
 * enforced is the shape of the request: the upload must belong to the submission named in the same
 * token, and the feature must still be active. Both are join conditions below.
 *
 * ACTIVE means `record_end_date IS NULL`, and deliberately NOT `record_effective_date <= now()`.
 * Features under validation review have never been published, so `record_effective_date` is NULL
 * for all of them and a published predicate would render an empty map. Reconciliation retires a
 * superseded upload's pending features by setting `record_end_date = now()`, so `IS NULL` is exactly
 * the set an administrator is reviewing. The predicate is written literally rather than as
 * `(record_end_date IS NULL OR now() < record_end_date)` because that literal form is what the
 * partial index `submission_feature_idx5_active_submission_upload` is defined on.
 *
 * The same predicate set is applied by
 * `SubmissionFeaturePropertyGeometryRepository.getSubmissionUploadGeometryExtent`, which decides
 * whether a map is offered and where it opens. If the two disagree the map either frames empty space
 * or claims the upload has no spatial properties while tiles still render. Change both together.
 *
 * There is no low zoom clustering. `martin_search` clusters because its candidate set is the whole
 * corpus; here the candidate set is bounded by one upload's features whatever the zoom, and the
 * query is driven from that side (see the join order comment) so a province-wide tile never scans
 * the geometry table. Revisit if uploads reach the order of a hundred thousand point geometries.
 *
 * SECURITY DEFINER with a pinned search_path: the function is owned by the migration role, which can
 * read the underlying tables, so the `martin` role needs EXECUTE on this function and nothing else.
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
    CREATE OR REPLACE FUNCTION biohub.martin_upload(z integer, x integer, y integer, query_params json)
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

      v_context_text         text;
      v_submission_id        integer;
      v_submission_upload_id uuid;
      v_env_3857             public.geometry;
      v_candidates_4326      public.geometry;
      v_mvt                  bytea;
    BEGIN
      -- The gateway strips every client supplied parameter and injects only this one, taken from the
      -- verified token. The function still treats it as untrusted: anything unparseable yields an
      -- empty tile rather than an error, so a probing client learns nothing from the difference.
      v_context_text := query_params ->> 'context';

      -- Case insensitive so a token minted from an upper case uuid still resolves; the API mints from
      -- the stored (lower case) value, so in practice the two never differ.
      IF v_context_text IS NULL
         OR v_context_text !~* '^su:[0-9]{1,10}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN NULL;
      END IF;

      BEGIN
        v_submission_id        := split_part(v_context_text, ':', 2)::integer;
        v_submission_upload_id := split_part(v_context_text, ':', 3)::uuid;
      EXCEPTION
        -- The pattern above bounds the digit count, not the magnitude, so a ten digit value can still
        -- overflow integer. The uuid cast is belt and braces: the pattern already guarantees the shape.
        WHEN numeric_value_out_of_range OR invalid_text_representation THEN
          RETURN NULL;
      END;

      v_env_3857 := public.ST_TileEnvelope(z, x, y);

      -- Candidates are selected against a BUFFERED envelope, because ST_AsMVTGeom renders into a
      -- c_buffer margin beyond the tile: geometry lying just outside the exact bounds still
      -- contributes to what this tile draws, so selecting on the exact envelope would drop it
      -- first and clip points and strokes at every tile edge. ST_AsMVTGeom still receives the
      -- EXACT envelope below, so the rendered output is unchanged.
      --
      -- Geometry is stored in WGS84, so the envelope is transformed to match rather than
      -- transforming every candidate geometry, which would make the index unusable.
      v_candidates_4326 := public.ST_Transform(
        public.ST_Expand(v_env_3857, (public.ST_XMax(v_env_3857) - public.ST_XMin(v_env_3857)) * c_buffer / c_extent),
        4326
      );

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
          -- Enough to tell one spatial property from another, and to relate a geometry back to the
          -- feature under review. Attribute level security stays in the API.
          g.submission_feature_property_geometry_id,
          sf.submission_feature_id,
          g.feature_type_property_id,
          fp.display_name AS property_display_name,
          fp.name AS property_name
        -- Driven from submission_feature: the upload id is the selective predicate, served by the
        -- partial index submission_feature_idx5_active_submission_upload, and each feature's
        -- geometries are then fetched by submission_feature_id. Driving from the geometry table's
        -- GIST index instead would make a low zoom tile scan every geometry in the envelope, which
        -- at zoom 4 is the whole province.
        FROM biohub.submission_feature sf
        JOIN biohub.submission_feature_property_geometry g
          ON g.submission_feature_id = sf.submission_feature_id
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
        WHERE sf.submission_upload_id = v_submission_upload_id
          -- The submission is part of the token, so a token cannot be replayed against an upload id
          -- that belongs to a different submission than the one that was authorized.
          AND sf.submission_id = v_submission_id
          -- Active, not published: see the function comment. Keep this literal form.
          AND sf.record_end_date IS NULL
          AND g.value && v_candidates_4326
      ) feature_rows
      WHERE feature_rows.geom IS NOT NULL;

      -- ST_AsMVT returns a zero length bytea (NOT NULL) when nothing matches. Normalize that to NULL
      -- so Martin serves an unambiguous empty tile (204) rather than a 0 byte body.
      RETURN NULLIF(v_mvt, ''::bytea);
    END
    $fn$;

    -- Martin parses the function comment as TileJSON metadata and logs a warning if it is not valid
    -- JSON, so the description is provided as a TileJSON fragment rather than prose.
    COMMENT ON FUNCTION biohub.martin_upload(integer, integer, integer, json) IS
      '{"description": "Spatial property vector tiles for every active submission feature of one submission upload. The submission and upload identifiers are carried by the verified token, and the upload to submission relationship is re-checked here."}';

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
      REVOKE ALL ON FUNCTION biohub.martin_upload(integer, integer, integer, json) FROM PUBLIC;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_martin_role) THEN
        -- The tile function only. The martin role gets no table privileges.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_upload(integer, integer, integer, json) TO %I', v_martin_role);
      ELSE
        RAISE WARNING 'Role % does not exist, skipping martin_upload grant.', v_martin_role;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_api_role) THEN
        -- The API role needs EXECUTE so the integration tests can exercise the tile SQL directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_upload(integer, integer, integer, json) TO %I', v_api_role);
      END IF;
    END
    $grants$;
  `);
}
