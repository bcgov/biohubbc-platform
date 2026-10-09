import { IDBConnection } from '../database/db';
import { SubmissionFeatureErrorsResponse } from '../models/submission-feature-error';
import { SubmissionUploadScope } from '../models/submission-upload';
import { SubmissionFeatureErrorRepository } from '../repositories/submission-feature-error-repository';
import { makePaginationResponse } from '../utils/pagination';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

export class SubmissionFeatureErrorService extends DBService {
  submissionFeatureErrorRepository: SubmissionFeatureErrorRepository;
  submissionUploadService: SubmissionUploadService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureErrorRepository = new SubmissionFeatureErrorRepository(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
  }

  /**
   * Retrieve a bounded page of the aggregated ingestion errors of an upload, after checking ownership.
   *
   * @param {SubmissionUploadScope} scope Submission and upload ownership boundary.
   * @param {ApiPaginationOptions} pagination Validated pagination and sorting options.
   * @returns {Promise<SubmissionFeatureErrorsResponse>} Errors and pagination totals, including empty pages.
   * @throws {ApiNotFoundError} When the upload does not belong to the submission.
   */
  async listSubmissionFeatureErrors(
    scope: SubmissionUploadScope,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureErrorsResponse> {
    await this.submissionUploadService.getSubmissionUploadBySubmissionId(scope.submissionId, scope.submissionUploadId);

    const errors = await this.submissionFeatureErrorRepository.listSubmissionFeatureErrors(
      scope.submissionUploadId,
      pagination
    );
    const total = await this.submissionFeatureErrorRepository.countSubmissionFeatureErrors(scope.submissionUploadId);

    return { errors, pagination: makePaginationResponse(total, pagination) };
  }
}
