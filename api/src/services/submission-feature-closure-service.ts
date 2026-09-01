import { IDBConnection } from '../database/db';
import { SubmissionFeatureClosureRepository } from '../repositories/submission-feature-closure-repository';
import { DBService } from './db-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

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
   * Recompute the directed reachability closure for a single submission.
   *
   * The closure is reachability over the union of parent and property (feature-reference) edges,
   * recomputed wholesale for the submission so it always reflects the current live feature graph across
   * all of the submission's uploads rather than an accumulation of prior states. Successive uploads
   * create new physical occurrences, so cross-upload edges (a live feature parented by or referencing a
   * current feature from an earlier upload) are part of the graph. Content edges are intentionally
   * excluded (closing over parent + content is O(N^2)). Reachability is stored as directed
   * `(source, target)` rows probed in both directions: the composite `(source, target)` primary key
   * serves forward probes by source (auth's ancestor walk; what an evidence feature reaches), and a
   * secondary `(target, source)` index serves search's reverse "who reaches Y" down-probe by target (a
   * feature's descendants + referencing entities, for filter-the-container/return-the-contained
   * searches). Each row carries `is_ancestor`: all rows form the search/evidence reach, while the
   * `is_ancestor = true` subset (pure parent-ancestry) is the authorization reach.
   *
   * Recomputed wholesale: the submission's prior closure rows are deleted, then the closure is
   * recomputed from the current feature graph. The caller runs both statements in one transaction (the
   * job handler's `withConnection`, or the upload-activation transaction), so the recompute is atomic
   * and idempotent under retry — a deleted-but-not-yet-reinserted state is never visible to another
   * reader, and rerunning converges on the same rows rather than accumulating duplicates.
   *
   * The returned `insertedCount` is log context only — no caller consumes it as a value, and a count
   * of zero is a valid result for a submission whose features are all inactive.
   *
   * @param {number} submissionId The submission scope.
   * @return {Promise<{ insertedCount: number }>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureService
   */
  async computeClosureForSubmission(submissionId: number): Promise<{ insertedCount: number }> {
    await this.submissionFeatureClosureRepository.invalidateClosureForSubmission(submissionId);

    const insertedCount = await this.submissionFeatureClosureRepository.computeClosureForSubmission(submissionId);

    return { insertedCount };
  }

  /**
   * Invalidate the derived graph for a submission.
   *
   * Approval calls this after feature activation in the same transaction. Once committed, the
   * absence of closure self-loops makes authorization fail closed until the asynchronous rebuild
   * completes. Closure rows are derived state and are hard-deleted rather than temporally retired.
   *
   * @param {number} submissionId Submission identifier whose derived closure rows are removed.
   * @returns {Promise<void>} Resolves after the submission's closure rows have been deleted.
   * @memberof SubmissionFeatureClosureService
   */
  async invalidateClosureForSubmission(submissionId: number): Promise<void> {
    await this.submissionFeatureClosureRepository.invalidateClosureForSubmission(submissionId);
  }

  /**
   * Recompute the closure for the submission that owns the given upload.
   *
   * Convenience wrapper over {@link computeClosureForSubmission}: closure is a
   * submission-scoped structure, so recomputing "for an upload" means recomputing the
   * owning submission's closure.
   *
   * @param {string} submissionUploadId The submission upload whose submission's closure is recomputed.
   * @return {Promise<{ insertedCount: number }>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureService
   */
  async computeClosureForUpload(submissionUploadId: string): Promise<{ insertedCount: number }> {
    const submissionUpload = await new SubmissionUploadService(this.connection).getSubmissionUpload(submissionUploadId);

    return this.computeClosureForSubmission(submissionUpload.submission_id);
  }
}
