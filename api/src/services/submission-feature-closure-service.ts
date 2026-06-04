import { IDBConnection } from '../database/db';
import { SubmissionFeatureClosureRepository } from '../repositories/submission-feature-closure-repository';
import { DBService } from './db-service';

/**
 * Service for the derived submission feature closure table.
 *
 * @export
 * @class SubmissionFeatureClosureService
 * @extends {DBService}
 */
export class SubmissionFeatureClosureService extends DBService {
  submissionFeatureClosureRepository: SubmissionFeatureClosureRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureClosureRepository = new SubmissionFeatureClosureRepository(connection);
  }

  /**
   * Recompute the directed reachability closure for a single upload.
   *
   * The closure is reachability over the union of parent and property (feature-reference) edges,
   * recomputed wholesale for the upload so it always reflects the upload's current feature graph rather
   * than an accumulation of prior states. Content edges are intentionally excluded (closing over
   * parent + content is O(N^2)). Reachability is stored as directed `(source, target)` rows probed in
   * both directions: the composite `(source, target)` primary key serves forward probes by source (auth's
   * ancestor walk; what an evidence feature reaches), and a secondary `(target, source)` index serves
   * search's reverse "who reaches Y" down-probe by target (a feature's descendants + referencing entities,
   * for filter-the-container/return-the-contained searches). Each row carries `is_ancestor`: all rows form
   * the search/evidence reach, while the `is_ancestor = true` subset (pure parent-ancestry) is the
   * authorization reach.
   *
   * Recomputed wholesale: the upload's prior closure rows are deleted, then the closure is recomputed
   * from the upload's current feature graph. The caller runs both statements in one transaction (the job
   * handler's `withConnection`), so the recompute is atomic and idempotent under retry — a
   * deleted-but-not-yet-reinserted state is never visible to another reader, and rerunning converges on
   * the same rows rather than accumulating duplicates.
   *
   * The returned `insertedCount` is log context only — no caller consumes it as a value, and a count
   * of zero is a valid result for an upload whose features are all inactive.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @return {Promise<{ insertedCount: number }>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureService
   */
  async computeClosureForUpload(submissionUploadId: string): Promise<{ insertedCount: number }> {
    await this.submissionFeatureClosureRepository.deleteClosureForUpload(submissionUploadId);

    const insertedCount = await this.submissionFeatureClosureRepository.computeClosureForUpload(submissionUploadId);

    return { insertedCount };
  }
}
