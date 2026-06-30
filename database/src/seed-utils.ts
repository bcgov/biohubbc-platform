import { Knex } from 'knex';

export type SeedConnection = Knex | Knex.Transaction;

/**
 * Recompute the derived reachability closure for a single upload (DELETE + recursive-CTE INSERT).
 *
 * Mirrors `SubmissionFeatureClosureRepository.deleteClosureForUpload` +
 * `SubmissionFeatureClosureRepository.computeClosureForUpload` as a standalone knex helper, since the
 * database package cannot import the api repository. Closure is reachability over the upload's parent
 * and property (feature-reference) edges — content edges (submission_feature_feature) are intentionally
 * excluded. `is_ancestor` flags the pure parent-ancestry subset (the authorization reach); search reads
 * all rows. Delete-then-insert in one transaction keeps the wholesale recompute idempotent.
 *
 * Seeds MUST call this for every upload they create. Read-path security (isEffectivelySecured /
 * isAccessibleToUser) resolves against this table and fails closed when a feature has no closure rows,
 * so closure-less seeded features read as secured-and-inaccessible to everyone — hiding them from search
 * and raising the "Request Data" banner even when nothing is actually policy-secured.
 *
 * @param {SeedConnection} knex
 * @param {string} submission_upload_id The submission upload scope.
 * @returns {Promise<void>}
 */
export const computeSubmissionFeatureClosureForUpload = async (
  knex: SeedConnection,
  submission_upload_id: string
): Promise<void> => {
  await knex.raw(
    `
      DELETE FROM submission_feature_closure c
      USING submission_feature sf
      WHERE sf.submission_upload_id = ?::uuid
        AND c.source_submission_feature_id = sf.submission_feature_id;
    `,
    [submission_upload_id]
  );

  await knex.raw(
    `
      WITH RECURSIVE
      active_features AS (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_upload_id = ?::uuid
          AND record_end_date IS NULL
      ),
      self_loops AS (
        SELECT submission_feature_id AS source, submission_feature_id AS target
        FROM active_features
      ),
      parent_edges AS (
        SELECT child.submission_feature_id AS source, child.parent_submission_feature_id AS target
        FROM submission_feature child
        JOIN active_features af_src ON af_src.submission_feature_id = child.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL
      ),
      property_edges AS (
        SELECT pf.submission_feature_id AS source, pf.referenced_submission_feature_id AS target
        FROM submission_feature_property_feature pf
        JOIN active_features af_src ON af_src.submission_feature_id = pf.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = pf.referenced_submission_feature_id
      ),
      ancestry_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
      ),
      direct_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
        UNION ALL SELECT source, target FROM property_edges
      ),
      ancestry_closure AS (
        SELECT source, target FROM ancestry_edges
        UNION
        SELECT c.source, d.target
        FROM ancestry_closure c
        JOIN ancestry_edges d ON d.source = c.target
      ),
      closure AS (
        SELECT source, target FROM direct_edges
        UNION
        SELECT c.source, d.target
        FROM closure c
        JOIN direct_edges d ON d.source = c.target
      )
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      SELECT cl.source, cl.target, (anc.source IS NOT NULL) AS is_ancestor
      FROM closure cl
      LEFT JOIN ancestry_closure anc
        ON anc.source = cl.source AND anc.target = cl.target;
    `,
    [submission_upload_id]
  );
};
