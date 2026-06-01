import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from './base-repository';

/**
 * Repository class for the derived submission feature closure table.
 *
 * @export
 * @class SubmissionFeatureClosureRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureClosureRepository extends BaseRepository {
  /**
   * Recompute the directed reachability closure for a single upload.
   *
   * Delegates to the canonical `biohub.compute_submission_feature_closure` PG function, which owns
   * the closure-recompute logic so it stays consistent no matter what triggers it. The function is a
   * wholesale DELETE + INSERT for the upload's rows, making it idempotent — rerunning it converges
   * on the same state rather than accumulating duplicates.
   *
   * Returns the number of closure rows written. An upload whose features are all inactive
   * legitimately writes zero rows, so a count of 0 is a valid result, not a failure. This is why
   * there is deliberately no row-count guard here: the function always returns exactly one row
   * carrying the count, and a zero count is meaningful data the caller must be able to observe.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @return {Promise<number>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureRepository
   */
  async computeClosureForUpload(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`SELECT biohub.compute_submission_feature_closure(${submissionUploadId}) AS inserted_count`;

    const response = await this.connection.sql(sqlStatement, z.object({ inserted_count: z.number().int() }));

    return response.rows[0].inserted_count;
  }
}
