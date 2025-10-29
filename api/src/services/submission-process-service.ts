import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { extractFeaturesJson } from '../utils/tar-utils';
import { DBService } from './db-service';
import { BucketType, ObjectStorageService } from './object-storage/object-storage-service';
import { RegionService } from './region-service';
import { SearchIndexService } from './search-index-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

export class SubmissionProcessService extends DBService {
  private validationService: ValidationService;
  private submissionService: SubmissionService;
  private searchIndexService: SearchIndexService;
  private regionService: RegionService;
  private objectStorageService: ObjectStorageService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.validationService = new ValidationService(connection);
    this.submissionService = new SubmissionService(connection);
    this.searchIndexService = new SearchIndexService(connection);
    this.regionService = new RegionService(connection);
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Process a submission by its ID.
   *
   * Steps:
   * 1. Fetch submission record
   * 2. Validate submission features
   * 3. Download submission resource
   * 4. Index features
   * 5. Calculate regions
   *
   * @param {number} submissionId
   * @returns {*}  {Promise<any>}
   */
  async processSubmission(submissionId: number): Promise<any> {
    // 1. Fetch the submission record
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

    if (!submissionRecord.uri) {
      throw new ApiGeneralError('Submission URI does not exist.');
    }

    // 2. Download the submission features
    const tarball = await this.objectStorageService.getFileAsBuffer(BucketType.MAIN, submissionRecord.uri);

    const submissionFeatures = await extractFeaturesJson(tarball);

    if (!submissionFeatures.length) {
      throw new HTTP400('Submission has no features');
    }

    // 3. Validate submission features
    const isValid = await this.validationService.validateSubmissionFeatures(submissionFeatures);
    if (!isValid) {
      throw new HTTP400('Submission features are invalid');
    }

    // 5. Index features
    await this.searchIndexService.indexFeaturesBySubmissionId(submissionRecord.submission_id);

    // 6. Calculate regions
    await this.regionService.calculateAndAddRegionsForSubmission(submissionRecord.submission_id, 0.3);

    return {
      submission_uuid: submissionRecord.uuid
    };
  }
}
