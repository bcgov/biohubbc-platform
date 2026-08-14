import { Knex } from 'knex';
import { escapeLiteral } from '../utils/migrations';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';
const DB_USER_API = process.env.DB_USER_API || 'biohub_api';

/**
 * Create the authorized search-result vector tile function and its expression evaluator.
 *
 * This is where data visibility is enforced. The Martin Gateway only authenticates: it proves a request
 * carries a valid token and forwards the opaque context id. What that context is allowed to see is
 * decided here, in SQL, every time a tile is generated.
 *
 * A context stores a persisted search `expression_id` (NULL = unfiltered browse-all) and the caller's
 * `system_user_id` (NULL = anonymous). Nothing about the result set is materialized anywhere: each tile
 * restricts candidates to the tile envelope first (the GIST-indexed condition), then evaluates the
 * persisted expression and the caller's live authorization per candidate. Three properties follow:
 *
 * 1. Securing a feature, or revoking a team membership, changes newly generated tiles immediately.
 *    The exposure window is Martin's tile cache expiry, not the token or context lifetime.
 * 2. A search of any size can be mapped: per-tile cost scales with the candidates inside the envelope,
 *    never with the size of the full result set.
 * 3. A client cannot widen its own access. The only input it influences is an opaque id, which
 *    resolves to a server-side row holding the expression and user identity.
 *
 * The evaluator is a per-candidate port of the TypeScript search evaluator
 * (`api/src/repositories/expression-evaluation.ts`): set INTERSECT/UNION over anchor ids is equivalent
 * to AND/OR of per-anchor membership, so `martin_expression_matches` recurses over the persisted
 * `expression`/`expression_clause` tree and `martin_predicate_matches` reproduces one predicate's
 * evidence-then-projection semantics as a single static EXISTS. The security predicate
 * (`martin_feature_accessible`) is a direct port of `isEffectivelySecured`/`isAccessibleToUser` in
 * `api/src/repositories/sql-fragments.ts`, applied at the same two points the search applies it: on
 * the evidence rows inside each predicate, and once on the anchor. Keeping the semantics identical —
 * including `status = 'active'` and the fail-closed missing-self-loop probe — is what stops the map
 * and the table view from ever disagreeing.
 *
 * SECURITY DEFINER with a pinned search_path: the tile function is owned by the migration role, which
 * can read the underlying tables, so the `martin` role needs EXECUTE on that function and nothing else
 * — no table privileges at all. The pinned search_path prevents an attacker-controlled path from
 * resolving these table names elsewhere.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path = biohub, public;

    -- Earlier shape of the resolver (materialized-result-set based). The signature changed, and
    -- CREATE OR REPLACE cannot replace a function under a different signature, so an existing
    -- database would otherwise keep both.
    DROP FUNCTION IF EXISTS biohub.martin_search_visible_geometries(uuid, boolean, integer, text, uuid[], public.geometry);

    ----------------------------------------------------------------------------------------
    -- Effective security probe
    --
    -- Port of isEffectivelySecured (api/src/repositories/sql-fragments.ts): a feature is secured
    -- when any closure ancestor carries an active security application — or, fail closed, when the
    -- reflexive closure self-loop is missing, because then the closure is not built and the feature
    -- cannot be proven unsecured.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_feature_is_secured(p_submission_feature_id integer)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    COST 1000
    AS $fn$
      SELECT
        EXISTS (
          SELECT 1
          FROM biohub.submission_feature_closure c
          JOIN biohub.submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
          JOIN biohub.submission_feature sf_sec ON sf_sec.submission_feature_id = c.target_submission_feature_id
          WHERE c.source_submission_feature_id = p_submission_feature_id
            AND c.is_ancestor = true
            AND sfs.record_end_date IS NULL
            AND sfs.status = 'active'
            AND sf_sec.record_effective_date <= now()
            AND (sf_sec.record_end_date IS NULL OR now() < sf_sec.record_end_date)
        )
        OR NOT EXISTS (
          SELECT 1
          FROM biohub.submission_feature_closure c
          WHERE c.source_submission_feature_id = p_submission_feature_id
            AND c.target_submission_feature_id = p_submission_feature_id
        );
    $fn$;

    COMMENT ON FUNCTION biohub.martin_feature_is_secured(integer) IS
      'True when the feature is effectively secured. Port of isEffectivelySecured in api/src/repositories/sql-fragments.ts, including the fail-closed missing-closure probe.';

    ----------------------------------------------------------------------------------------
    -- Live accessibility predicate
    --
    -- Port of buildSecurityFilter (api/src/repositories/sql-fragments.ts): an anonymous caller
    -- (NULL user) sees unsecured features only; an authenticated caller additionally sees features
    -- whose closure reaches a security-scope anchor held by one of their live teams. Evaluated live
    -- on every call, so revoking a membership takes effect on the next generated tile.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_feature_accessible(
      p_submission_feature_id integer,
      p_system_user_id        integer
    )
    RETURNS boolean
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    COST 2000
    AS $fn$
      SELECT
        NOT biohub.martin_feature_is_secured(p_submission_feature_id)
        OR (
          p_system_user_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM biohub.submission_feature_closure c
            JOIN biohub.security_scope_anchor ssa ON ssa.anchor_submission_feature_id = c.target_submission_feature_id
            JOIN biohub.team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
            JOIN biohub.team t ON t.team_id = tss.team_id AND t.record_end_date IS NULL
            JOIN biohub.team_member tm ON tm.team_id = tss.team_id
              AND tm.system_user_id = p_system_user_id
              AND tm.record_end_date IS NULL
            WHERE c.source_submission_feature_id = p_submission_feature_id
              AND c.is_ancestor = true
          )
        );
    $fn$;

    COMMENT ON FUNCTION biohub.martin_feature_accessible(integer, integer) IS
      'True when the caller may see the feature. Port of buildSecurityFilter/isAccessibleToUser in api/src/repositories/sql-fragments.ts, evaluated live against team membership. NULL user = anonymous.';

    ----------------------------------------------------------------------------------------
    -- Per-candidate predicate evaluator
    --
    -- One persisted predicate against one candidate anchor feature. Reproduces the TypeScript
    -- evidence-then-projection semantics (expression-evaluation.ts) as a static EXISTS:
    --
    -- * evidence rows come from the typed property table matching the predicate payload, joined
    --   through a live feature_type_property on the predicate's shared feature_property_id, with an
    --   optional feature_type_property narrowing;
    -- * same-type evidence must BE the anchor row; different-type evidence may connect to the anchor
    --   through submission_feature_closure in either direction (feature type ids stand in for the
    --   type-name comparison the TypeScript builder makes — live type names are unique);
    -- * evidence the caller cannot see is discarded before projection, so secured evidence cannot
    --   influence visible results;
    -- * NotEquals is feature-level, not row-level: the evidence feature carries the property and has
    --   NO row equal to the requested value (a [red, blue] feature must not match NotEquals red via
    --   the blue row).
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_predicate_matches(
      p_predicate_id           uuid,
      p_anchor_id              integer,
      p_anchor_feature_type_id integer,
      p_system_user_id         integer
    )
    RETURNS boolean
    LANGUAGE plpgsql
    STABLE
    PARALLEL SAFE
    COST 100000
    AS $fn$
    DECLARE
      v_p record;
    BEGIN
      -- The predicate anchor plus whichever typed payload row it carries (exactly one exists).
      -- A missing or end-dated predicate fails closed: the candidate does not match.
      SELECT
        p.feature_property_id                       AS fp_id,
        p.feature_type_property_id                  AS ftp_id,
        ps.predicate_string_id                      AS string_id,
        ps.value                                    AS string_value,
        ps.operator::text                           AS string_op,
        pn.predicate_number_id                      AS number_id,
        pn.value                                    AS number_value,
        pn.operator::text                           AS number_op,
        pb.predicate_boolean_id                     AS boolean_id,
        pb.value                                    AS boolean_value,
        pb.operator::text                           AS boolean_op,
        pt.predicate_timestamp_id                   AS ts_id,
        pt.date_value                               AS ts_date_value,
        pt.time_value::time                         AS ts_time_value,
        pt.operator::text                           AS ts_op,
        px.predicate_taxon_id                       AS taxon_id,
        px.taxon_id                                 AS taxon_value,
        px.operator::text                           AS taxon_op,
        pg.predicate_geometry_id                    AS geometry_id,
        pg.value                                    AS geometry_value,
        pg.operator::text                           AS geometry_op,
        pc.predicate_code_id                        AS code_id,
        pc.contributor_codeset_code_id              AS code_value,
        pc.operator::text                           AS code_op
      INTO v_p
      FROM biohub.predicate p
      LEFT JOIN biohub.predicate_string    ps ON ps.predicate_id = p.predicate_id AND ps.record_end_date IS NULL
      LEFT JOIN biohub.predicate_number    pn ON pn.predicate_id = p.predicate_id AND pn.record_end_date IS NULL
      LEFT JOIN biohub.predicate_boolean   pb ON pb.predicate_id = p.predicate_id AND pb.record_end_date IS NULL
      LEFT JOIN biohub.predicate_timestamp pt ON pt.predicate_id = p.predicate_id AND pt.record_end_date IS NULL
      LEFT JOIN biohub.predicate_taxon     px ON px.predicate_id = p.predicate_id AND px.record_end_date IS NULL
      LEFT JOIN biohub.predicate_geometry  pg ON pg.predicate_id = p.predicate_id AND pg.record_end_date IS NULL
      LEFT JOIN biohub.predicate_code      pc ON pc.predicate_id = p.predicate_id AND pc.record_end_date IS NULL
      WHERE p.predicate_id = p_predicate_id
        AND p.record_end_date IS NULL;

      IF NOT FOUND THEN
        RETURN false;
      END IF;

      IF v_p.string_id IS NOT NULL THEN
        IF v_p.string_op = 'NotEquals' THEN
          RETURN EXISTS (
            SELECT 1
            FROM biohub.submission_feature_property_string pv
            JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
            JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
            JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
            WHERE ftp.feature_property_id = v_p.fp_id
              AND ftp.record_end_date IS NULL
              AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
              AND esf.record_effective_date <= now()
              AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
              AND (
                (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
                OR (
                  esf.feature_type_id <> p_anchor_feature_type_id
                  AND (
                    EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cf
                      WHERE cf.source_submission_feature_id = p_anchor_id
                        AND cf.target_submission_feature_id = esf.submission_feature_id
                    )
                    OR EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cr
                      WHERE cr.source_submission_feature_id = esf.submission_feature_id
                        AND cr.target_submission_feature_id = p_anchor_id
                    )
                  )
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM biohub.submission_feature_property_string pne
                WHERE pne.submission_feature_id = pv.submission_feature_id
                  AND (
                    (v_p.ftp_id IS NOT NULL AND pne.feature_type_property_id = v_p.ftp_id)
                    OR (
                      v_p.ftp_id IS NULL
                      AND EXISTS (
                        SELECT 1 FROM biohub.feature_type_property ftp_ne
                        WHERE ftp_ne.feature_type_property_id = pne.feature_type_property_id
                          AND ftp_ne.feature_property_id = v_p.fp_id
                          AND ftp_ne.record_end_date IS NULL
                      )
                    )
                  )
                  AND pne.value = v_p.string_value
              )
              AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
          );
        END IF;

        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_string pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.string_op = 'Equals' AND pv.value = v_p.string_value)
              OR (v_p.string_op = 'Like' AND pv.value LIKE v_p.string_value)
              OR (v_p.string_op IN ('ILike', 'Contains') AND pv.value ILIKE '%' || v_p.string_value || '%')
              OR (v_p.string_op = 'StartsWith' AND pv.value ILIKE v_p.string_value || '%')
              OR (v_p.string_op = 'EndsWith' AND pv.value ILIKE '%' || v_p.string_value)
              OR (v_p.string_op = 'Exists' AND pv.value IS NOT NULL)
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.number_id IS NOT NULL THEN
        IF v_p.number_op = 'NotEquals' THEN
          RETURN EXISTS (
            SELECT 1
            FROM biohub.submission_feature_property_number pv
            JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
            JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
            JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
            WHERE ftp.feature_property_id = v_p.fp_id
              AND ftp.record_end_date IS NULL
              AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
              AND esf.record_effective_date <= now()
              AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
              AND (
                (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
                OR (
                  esf.feature_type_id <> p_anchor_feature_type_id
                  AND (
                    EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cf
                      WHERE cf.source_submission_feature_id = p_anchor_id
                        AND cf.target_submission_feature_id = esf.submission_feature_id
                    )
                    OR EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cr
                      WHERE cr.source_submission_feature_id = esf.submission_feature_id
                        AND cr.target_submission_feature_id = p_anchor_id
                    )
                  )
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM biohub.submission_feature_property_number pne
                WHERE pne.submission_feature_id = pv.submission_feature_id
                  AND (
                    (v_p.ftp_id IS NOT NULL AND pne.feature_type_property_id = v_p.ftp_id)
                    OR (
                      v_p.ftp_id IS NULL
                      AND EXISTS (
                        SELECT 1 FROM biohub.feature_type_property ftp_ne
                        WHERE ftp_ne.feature_type_property_id = pne.feature_type_property_id
                          AND ftp_ne.feature_property_id = v_p.fp_id
                          AND ftp_ne.record_end_date IS NULL
                      )
                    )
                  )
                  AND pne.value = v_p.number_value
              )
              AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
          );
        END IF;

        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_number pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.number_op = 'Equals' AND pv.value = v_p.number_value)
              OR (v_p.number_op = 'GreaterThan' AND pv.value > v_p.number_value)
              OR (v_p.number_op = 'GreaterThanOrEqual' AND pv.value >= v_p.number_value)
              OR (v_p.number_op = 'LessThan' AND pv.value < v_p.number_value)
              OR (v_p.number_op = 'LessThanOrEqual' AND pv.value <= v_p.number_value)
              OR (v_p.number_op = 'Exists' AND pv.value IS NOT NULL)
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.boolean_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_boolean pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.boolean_op = 'Equals' AND pv.value = v_p.boolean_value)
              OR (v_p.boolean_op = 'Exists' AND pv.value IS NOT NULL)
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.ts_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_timestamp pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.ts_op = 'Exists' AND (pv.date_value IS NOT NULL OR pv.time_value IS NOT NULL))
              OR (v_p.ts_op = 'OnDate' AND pv.date_value = v_p.ts_date_value)
              OR (v_p.ts_op = 'OnTime' AND pv.time_value = v_p.ts_time_value)
              OR (
                v_p.ts_op = 'Before'
                AND (
                  (v_p.ts_date_value IS NOT NULL AND v_p.ts_time_value IS NOT NULL
                    AND (pv.date_value + pv.time_value) < (v_p.ts_date_value + v_p.ts_time_value))
                  OR (v_p.ts_date_value IS NOT NULL AND v_p.ts_time_value IS NULL
                    AND pv.date_value < v_p.ts_date_value)
                  OR (v_p.ts_date_value IS NULL AND v_p.ts_time_value IS NOT NULL
                    AND pv.time_value < v_p.ts_time_value)
                )
              )
              OR (
                v_p.ts_op = 'After'
                AND (
                  (v_p.ts_date_value IS NOT NULL AND v_p.ts_time_value IS NOT NULL
                    AND (pv.date_value + pv.time_value) > (v_p.ts_date_value + v_p.ts_time_value))
                  OR (v_p.ts_date_value IS NOT NULL AND v_p.ts_time_value IS NULL
                    AND pv.date_value > v_p.ts_date_value)
                  OR (v_p.ts_date_value IS NULL AND v_p.ts_time_value IS NOT NULL
                    AND pv.time_value > v_p.ts_time_value)
                )
              )
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.taxon_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_taxon pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          JOIN biohub.taxon tx ON tx.taxon_id = pv.taxon_id AND tx.record_end_date IS NULL
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.taxon_op = 'Equals' AND pv.taxon_id = v_p.taxon_value)
              OR (v_p.taxon_op = 'Exists' AND pv.taxon_id IS NOT NULL)
              OR (
                v_p.taxon_op = 'ChildOf'
                AND (SELECT t2.parent_taxon_id FROM biohub.taxon t2 WHERE t2.taxon_id = pv.taxon_id) = v_p.taxon_value
              )
              OR (
                v_p.taxon_op = 'ParentOf'
                AND EXISTS (
                  WITH RECURSIVE ancestors AS (
                    SELECT taxon_id, parent_taxon_id, 0 AS depth
                    FROM biohub.taxon
                    WHERE taxon_id = v_p.taxon_value
                    UNION ALL
                    SELECT parent.taxon_id, parent.parent_taxon_id, ancestors.depth + 1
                    FROM biohub.taxon parent
                    JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
                    WHERE parent.record_end_date IS NULL
                  )
                  SELECT 1 FROM ancestors WHERE taxon_id = pv.taxon_id AND depth = 1
                )
              )
              OR (
                v_p.taxon_op = 'AscendsFrom'
                AND EXISTS (
                  WITH RECURSIVE ancestors AS (
                    SELECT taxon_id, parent_taxon_id
                    FROM biohub.taxon
                    WHERE taxon_id = v_p.taxon_value
                    UNION ALL
                    SELECT parent.taxon_id, parent.parent_taxon_id
                    FROM biohub.taxon parent
                    JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
                    WHERE parent.record_end_date IS NULL
                  )
                  SELECT 1 FROM ancestors WHERE taxon_id = pv.taxon_id
                )
              )
              OR (
                v_p.taxon_op = 'DescendsFrom'
                AND EXISTS (
                  WITH RECURSIVE ancestors AS (
                    SELECT taxon_id, parent_taxon_id
                    FROM biohub.taxon
                    WHERE taxon_id = pv.taxon_id
                    UNION ALL
                    SELECT parent.taxon_id, parent.parent_taxon_id
                    FROM biohub.taxon parent
                    JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
                    WHERE parent.record_end_date IS NULL
                  )
                  SELECT 1 FROM ancestors WHERE taxon_id = v_p.taxon_value
                )
              )
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.geometry_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_geometry pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.geometry_op = 'Within' AND public.ST_Within(pv.value, public.ST_Force2D(v_p.geometry_value)))
              OR (v_p.geometry_op = 'Intersects' AND public.ST_Intersects(pv.value, public.ST_Force2D(v_p.geometry_value)))
              OR (v_p.geometry_op = 'Contains' AND public.ST_Contains(pv.value, public.ST_Force2D(v_p.geometry_value)))
              OR (v_p.geometry_op = 'Exists' AND pv.value IS NOT NULL)
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      IF v_p.code_id IS NOT NULL THEN
        IF v_p.code_op = 'NotEquals' THEN
          RETURN EXISTS (
            SELECT 1
            FROM biohub.submission_feature_property_code pv
            JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
            JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
            JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
            JOIN biohub.contributor_codeset_code csc ON csc.contributor_codeset_code_id = pv.contributor_codeset_code_id
              AND csc.record_end_date IS NULL
            JOIN biohub.contributor_codeset cs ON cs.contributor_codeset_id = csc.contributor_codeset_id
              AND cs.record_end_date IS NULL
            WHERE ftp.feature_property_id = v_p.fp_id
              AND ftp.record_end_date IS NULL
              AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
              AND esf.record_effective_date <= now()
              AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
              AND (
                (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
                OR (
                  esf.feature_type_id <> p_anchor_feature_type_id
                  AND (
                    EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cf
                      WHERE cf.source_submission_feature_id = p_anchor_id
                        AND cf.target_submission_feature_id = esf.submission_feature_id
                    )
                    OR EXISTS (
                      SELECT 1 FROM biohub.submission_feature_closure cr
                      WHERE cr.source_submission_feature_id = esf.submission_feature_id
                        AND cr.target_submission_feature_id = p_anchor_id
                    )
                  )
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM biohub.submission_feature_property_code pne
                WHERE pne.submission_feature_id = pv.submission_feature_id
                  AND (
                    (v_p.ftp_id IS NOT NULL AND pne.feature_type_property_id = v_p.ftp_id)
                    OR (
                      v_p.ftp_id IS NULL
                      AND EXISTS (
                        SELECT 1 FROM biohub.feature_type_property ftp_ne
                        WHERE ftp_ne.feature_type_property_id = pne.feature_type_property_id
                          AND ftp_ne.feature_property_id = v_p.fp_id
                          AND ftp_ne.record_end_date IS NULL
                      )
                    )
                  )
                  AND pne.contributor_codeset_code_id = v_p.code_value
              )
              AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
          );
        END IF;

        RETURN EXISTS (
          SELECT 1
          FROM biohub.submission_feature_property_code pv
          JOIN biohub.submission_feature esf ON esf.submission_feature_id = pv.submission_feature_id
          JOIN biohub.feature_type eft ON eft.feature_type_id = esf.feature_type_id AND eft.record_end_date IS NULL
          JOIN biohub.feature_type_property ftp ON ftp.feature_type_property_id = pv.feature_type_property_id
          JOIN biohub.contributor_codeset_code csc ON csc.contributor_codeset_code_id = pv.contributor_codeset_code_id
            AND csc.record_end_date IS NULL
          JOIN biohub.contributor_codeset cs ON cs.contributor_codeset_id = csc.contributor_codeset_id
            AND cs.record_end_date IS NULL
          WHERE ftp.feature_property_id = v_p.fp_id
            AND ftp.record_end_date IS NULL
            AND (v_p.ftp_id IS NULL OR pv.feature_type_property_id = v_p.ftp_id)
            AND esf.record_effective_date <= now()
            AND (esf.record_end_date IS NULL OR now() < esf.record_end_date)
            AND (
              (esf.feature_type_id = p_anchor_feature_type_id AND esf.submission_feature_id = p_anchor_id)
              OR (
                esf.feature_type_id <> p_anchor_feature_type_id
                AND (
                  EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cf
                    WHERE cf.source_submission_feature_id = p_anchor_id
                      AND cf.target_submission_feature_id = esf.submission_feature_id
                  )
                  OR EXISTS (
                    SELECT 1 FROM biohub.submission_feature_closure cr
                    WHERE cr.source_submission_feature_id = esf.submission_feature_id
                      AND cr.target_submission_feature_id = p_anchor_id
                  )
                )
              )
            )
            AND (
              (v_p.code_op = 'Equals' AND pv.contributor_codeset_code_id = v_p.code_value)
              OR (v_p.code_op = 'Exists' AND pv.contributor_codeset_code_id IS NOT NULL)
            )
            AND biohub.martin_feature_accessible(pv.submission_feature_id, p_system_user_id)
        );
      END IF;

      -- No live payload row: fail closed.
      RETURN false;
    END
    $fn$;

    COMMENT ON FUNCTION biohub.martin_predicate_matches(uuid, integer, integer, integer) IS
      'True when the candidate anchor feature matches one persisted predicate under the caller''s live authorization. Per-candidate port of the evidence/projection semantics in api/src/repositories/expression-evaluation.ts.';

    ----------------------------------------------------------------------------------------
    -- Per-candidate expression evaluator
    --
    -- Recursive walk of the persisted expression tree. AND requires every clause, OR requires any,
    -- both short-circuiting. Set INTERSECT (AND) / UNION (OR) over anchor id sets — the TypeScript
    -- builder's composition — is exactly AND/OR of per-anchor membership, which is what makes this
    -- per-candidate form equivalent. A missing or end-dated expression fails closed.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_expression_matches(
      p_expression_id          uuid,
      p_anchor_id              integer,
      p_anchor_feature_type_id integer,
      p_system_user_id         integer
    )
    RETURNS boolean
    LANGUAGE plpgsql
    STABLE
    PARALLEL SAFE
    COST 100000
    AS $fn$
    DECLARE
      v_operator text;
      v_clause   record;
      v_result   boolean;
    BEGIN
      SELECT e.operator::text
      INTO v_operator
      FROM biohub.expression e
      WHERE e.expression_id = p_expression_id
        AND e.record_end_date IS NULL;

      IF NOT FOUND THEN
        RETURN false;
      END IF;

      FOR v_clause IN
        SELECT ec.predicate_id, ec.child_expression_id
        FROM biohub.expression_clause ec
        WHERE ec.expression_id = p_expression_id
          AND ec.record_end_date IS NULL
        ORDER BY ec.sequence
      LOOP
        IF v_clause.predicate_id IS NOT NULL THEN
          v_result := biohub.martin_predicate_matches(
            v_clause.predicate_id, p_anchor_id, p_anchor_feature_type_id, p_system_user_id
          );
        ELSE
          v_result := biohub.martin_expression_matches(
            v_clause.child_expression_id, p_anchor_id, p_anchor_feature_type_id, p_system_user_id
          );
        END IF;

        IF v_operator = 'AND' AND NOT v_result THEN
          RETURN false;
        END IF;

        IF v_operator = 'OR' AND v_result THEN
          RETURN true;
        END IF;
      END LOOP;

      -- All AND clauses passed / no OR clause passed. A clauseless expression cannot be persisted
      -- (write-time validation requires at least one clause), so this line only decides those.
      RETURN v_operator = 'AND';
    END
    $fn$;

    COMMENT ON FUNCTION biohub.martin_expression_matches(uuid, integer, integer, integer) IS
      'True when the candidate anchor feature matches the persisted expression tree under the caller''s live authorization. Recursive over expression_clause; AND/OR short-circuit.';

    ----------------------------------------------------------------------------------------
    -- Visible geometry resolver
    --
    -- The single place candidate visibility is decided. Both zoom branches of martin_search call
    -- this, so the raw feature view and the aggregated view can never diverge in what they expose.
    --
    -- Envelope first: the bounding-box overlap is the condition the GIST index on
    -- submission_feature_property_geometry(value) serves, and it is what keeps a tile from scanning
    -- the whole table. The expression and accessibility functions carry high COST so the planner
    -- evaluates them after the cheap indexed conditions.
    --
    -- Not granted to the martin role. It is only ever reached from martin_search, which is SECURITY
    -- DEFINER, so it executes with the definer's privileges there.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_search_visible_geometries(
      p_feature_type_id integer,
      p_system_user_id  integer,
      p_expression_id   uuid,
      p_envelope_4326   public.geometry
    )
    RETURNS TABLE (
      submission_feature_id integer,
      geometry_4326         public.geometry
    )
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    AS $fn$
      SELECT
        sf.submission_feature_id,
        g.value AS geometry_4326
      FROM biohub.submission_feature_property_geometry g
      JOIN biohub.submission_feature sf
        ON sf.submission_feature_id = g.submission_feature_id
      WHERE g.value && p_envelope_4326
        AND sf.feature_type_id = p_feature_type_id
        AND sf.record_effective_date <= now()
        AND (sf.record_end_date IS NULL OR now() < sf.record_end_date)
        AND biohub.martin_feature_accessible(sf.submission_feature_id, p_system_user_id)
        -- NULL expression = unfiltered browse-all: every accessible, active feature of the type.
        AND (
          p_expression_id IS NULL
          OR biohub.martin_expression_matches(
            p_expression_id, sf.submission_feature_id, p_feature_type_id, p_system_user_id
          )
        );
    $fn$;

    COMMENT ON FUNCTION biohub.martin_search_visible_geometries(integer, integer, uuid, public.geometry) IS
      'Resolves the geometries a tile context may see within a bounding box: envelope-limited candidates filtered by the caller''s live authorization and the persisted search expression. Called only from biohub.martin_search.';

    ----------------------------------------------------------------------------------------
    -- Tile function (the Martin function source)
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION biohub.martin_search(z integer, x integer, y integer, query_params json)
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
      c_cluster_below_zoom constant integer := 9;
      c_grid_cells         constant integer := 8;
      c_extent             constant integer := 4096;
      c_buffer             constant integer := 64;

      v_context_text text;
      v_context_id   uuid;
      v_ctx          record;
      v_env_3857        public.geometry;
      v_candidates_4326 public.geometry;
      v_cell_width   double precision;
      v_cell_height  double precision;
      v_mvt          bytea;
    BEGIN
      -- The gateway strips every client supplied parameter and injects only the context (plus an
      -- inert cache-version parameter), but the function still treats its input as untrusted:
      -- anything unparseable yields an empty tile rather than an error, so a probing client learns
      -- nothing from the difference.
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
        tc.feature_type_id,
        tc.system_user_id,
        tc.expression_id
      INTO v_ctx
      FROM biohub.martin_context tc
      WHERE tc.martin_context_id = v_context_id
        AND tc.record_end_date > now();

      IF NOT FOUND THEN
        RETURN NULL;
      END IF;

      -- The search evaluator only returns anchors whose feature type is live; mirror that here so
      -- an end-dated type disappears from the map exactly when it disappears from the table view.
      IF NOT EXISTS (
        SELECT 1 FROM biohub.feature_type ft
        WHERE ft.feature_type_id = v_ctx.feature_type_id
          AND ft.record_end_date IS NULL
      ) THEN
        RETURN NULL;
      END IF;

      v_env_3857 := public.ST_TileEnvelope(z, x, y);

      -- Candidates are selected against a BUFFERED envelope, because ST_AsMVTGeom renders into a
      -- c_buffer margin beyond the tile: geometry lying just outside the exact bounds still
      -- contributes to what this tile draws, so selecting on the exact envelope would drop it
      -- first and clip points and strokes at every tile edge. ST_AsMVTGeom still receives the
      -- EXACT envelope below, so the rendered output is unchanged.
      --
      -- Geometry is stored in WGS84, so the envelope is transformed to match rather than
      -- transforming every candidate geometry, which would make the GIST index unusable.
      v_candidates_4326 := public.ST_Transform(
        public.ST_Expand(v_env_3857, (public.ST_XMax(v_env_3857) - public.ST_XMin(v_env_3857)) * c_buffer / c_extent),
        4326
      );

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
              public.ST_Centroid(public.ST_Collect(gridded.point_3857)),
              v_env_3857,
              c_extent,
              c_buffer,
              true
            ) AS geom,
            count(*)::integer AS count
          FROM (
            SELECT
              feature_points.point_3857,
              -- Snap to CELL CENTRES, not to the tile's min corner. ST_SnapToGrid rounds to the
              -- nearest grid NODE, so a min-corner origin puts nodes exactly on the tile edges,
              -- where a node is the same world coordinate as the neighbouring tile's - each tile
              -- seeing only the features on its own side. Every seam then renders two overlapping
              -- cluster bubbles with split counts. Centre origins keep every node strictly inside
              -- one tile, and because the tile is exactly c_grid_cells cells wide, the lattice is
              -- GLOBAL for a zoom level: every feature belongs to one world cell regardless of
              -- which tile is being rendered.
              public.ST_SnapToGrid(
                feature_points.point_3857,
                public.ST_XMin(v_env_3857) + v_cell_width / 2,
                public.ST_YMin(v_env_3857) + v_cell_height / 2,
                v_cell_width,
                v_cell_height
              ) AS cell_node
            FROM (
              -- One point per feature, so a feature with many geometries counts once WITHIN a tile.
              --
              -- KNOWN LIMIT: this point is the centroid of the geometry rows that intersect THIS
              -- tile, not of the feature's whole geometry, so it is tile-dependent. For a feature
              -- with several geometry rows far enough apart to be returned by different tiles, each
              -- tile computes a different point, and two consequences follow: the feature can be
              -- counted once per tile, and - because the ownership filter below emits a cell only
              -- from the tile containing it - it can also be counted by NO tile, if its computed
              -- point lands in a tile that sees none of its geometry.
              --
              -- Both are unreachable while every feature has exactly one geometry row, which is the
              -- case today, and neither affects zoom >= c_cluster_below_zoom, where geometries are
              -- emitted individually. Fixing it properly means selecting cluster candidates by a
              -- PRECOMPUTED per-feature centroid rather than by geometry intersection, which would
              -- make the point tile-independent (and low-zoom tiles cheaper). That needs a stored,
              -- indexed centroid kept current on ingestion, so it is deliberately not done here.
              SELECT
                public.ST_Transform(
                  public.ST_Centroid(public.ST_Collect(visible.geometry_4326)),
                  3857
                ) AS point_3857
              FROM biohub.martin_search_visible_geometries(
                v_ctx.feature_type_id,
                v_ctx.system_user_id,
                v_ctx.expression_id,
                v_candidates_4326
              ) visible
              GROUP BY visible.submission_feature_id
            ) feature_points
          ) gridded
          -- Emit only the cells this tile OWNS. A feature straddling the tile edge is a candidate
          -- for both neighbouring tiles, but its cell node lies in exactly one of them, so exactly
          -- one tile renders its cluster - the other would otherwise paint a second bubble in its
          -- buffer margin.
          WHERE gridded.cell_node && v_env_3857
          GROUP BY gridded.cell_node
        ) cluster_rows
        WHERE cluster_rows.geom IS NOT NULL;
      ELSE
        SELECT public.ST_AsMVT(feature_rows.*, 'features', c_extent, 'geom')
        INTO v_mvt
        FROM (
          -- Geometry only: no feature identifiers or attributes are emitted. Everything the client
          -- needs to render is the shape itself; attribute-level data stays in the API.
          SELECT
            public.ST_AsMVTGeom(
              public.ST_Transform(visible.geometry_4326, 3857),
              v_env_3857,
              c_extent,
              c_buffer,
              true
            ) AS geom
          FROM biohub.martin_search_visible_geometries(
            v_ctx.feature_type_id,
            v_ctx.system_user_id,
            v_ctx.expression_id,
            v_candidates_4326
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
    COMMENT ON FUNCTION biohub.martin_search(integer, integer, integer, json) IS
      '{"description": "Authorized search result vector tiles. Resolves an opaque tile context id to its persisted search expression and user identity, and evaluates both live at serve time."}';

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
      REVOKE ALL ON FUNCTION biohub.martin_search(integer, integer, integer, json) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.martin_search_visible_geometries(integer, integer, uuid, public.geometry) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.martin_expression_matches(uuid, integer, integer, integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.martin_predicate_matches(uuid, integer, integer, integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.martin_feature_accessible(integer, integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION biohub.martin_feature_is_secured(integer) FROM PUBLIC;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_martin_role) THEN
        -- The tile function only. The martin role gets no table privileges and cannot call the
        -- resolver or evaluator functions directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_search(integer, integer, integer, json) TO %I', v_martin_role);
      ELSE
        RAISE WARNING 'Role % does not exist, skipping martin_search grant.', v_martin_role;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_api_role) THEN
        -- The API role needs all of these so the integration tests can exercise the tile SQL and
        -- the evaluator functions directly.
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_search(integer, integer, integer, json) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_search_visible_geometries(integer, integer, uuid, public.geometry) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_expression_matches(uuid, integer, integer, integer) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_predicate_matches(uuid, integer, integer, integer) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_feature_accessible(integer, integer) TO %I', v_api_role);
        EXECUTE format('GRANT EXECUTE ON FUNCTION biohub.martin_feature_is_secured(integer) TO %I', v_api_role);
      END IF;
    END
    $grants$;
  `);
}
