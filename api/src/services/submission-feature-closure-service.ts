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
   * Rebuild the directed reachability closure for a single upload.
   *
   * The closure is reachability over the union of parent, content, and property edges, rebuilt
   * wholesale for the upload so it always reflects the upload's current feature graph rather than an
   * accumulation of prior states.
   *
   * The returned `insertedCount` is log context only — no caller consumes it as a value, and a count
   * of zero is a valid result for an upload whose features are all inactive.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @return {Promise<{ insertedCount: number }>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureService
   */
  async rebuildClosureForUpload(submissionUploadId: string): Promise<{ insertedCount: number }> {
    return { insertedCount: await this.submissionFeatureClosureRepository.rebuildClosureForUpload(submissionUploadId) };
  }
}
