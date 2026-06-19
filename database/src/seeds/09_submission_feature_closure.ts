import { Knex } from 'knex';

type SeedConnection = Knex | Knex.Transaction;

/**
 * Recompute the derived submission_feature_closure rows for every upload that has active features.
 *
 * Earlier mock seeds insert large submission_feature graphs directly. The application normally queues
 * closure recompute after indexing, but seeds do not run that queue path, so local seed data needs a
 * final derived-data pass after all feature and relationship rows exist.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      SET SCHEMA 'biohub';
      SET SEARCH_PATH = 'biohub','public';
    `);

    const uploads = await trx('submission_feature')
      .distinct<{ submission_upload_id: string }[]>('submission_upload_id')
      .whereNull('record_end_date')
      .whereNotNull('submission_upload_id');

    for (const { submission_upload_id } of uploads) {
      await computeSubmissionFeatureClosureForUpload(trx, submission_upload_id);
    }
  });
}

/**
 * Recompute the derived reachability closure for a single upload (DELETE + recursive-CTE INSERT).
 *
 * Mirrors SubmissionFeatureClosureRepository.computeClosureForUpload. Closure includes self loops,
 * parent ancestry, and property feature references. Content edges in submission_feature_feature are
 * intentionally excluded by the application closure model.
 *
 * @param {SeedConnection} knex
 * @param {string} submissionUploadId The submission upload scope.
 * @returns {Promise<void>}
 */
const computeSubmissionFeatureClosureForUpload = async (
  knex: SeedConnection,
  submissionUploadId: string
): Promise<void> => {
  await knex.raw(
    `
      DELETE FROM submission_feature_closure c
      USING submission_feature sf
      WHERE sf.submission_upload_id = ?::uuid
        AND c.source_submission_feature_id = sf.submission_feature_id;
    `,
    [submissionUploadId]
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
    [submissionUploadId]
  );
};
