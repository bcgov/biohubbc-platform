import { DEFAULT_NUM_FEATURES_BATCH_SIZE } from '../constants/submission';
import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { SubmissionRecord2 } from '../models/submission';
import { ISubmissionFeature } from '../repositories/submission-repository';
import { extractFeaturesJsonFromStream } from '../utils/tar-utils';
import { DBService } from './db-service';
import { BucketType, ObjectStorageService } from './object-storage/object-storage-service';
import { QuarantineService } from './quarantine/quarantine-service';
import { RegionService } from './region-service';
import { SubmissionFeatureService } from './submission-feature-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

export class SubmissionProcessService extends DBService {
  private validationService: ValidationService;
  private submissionService: SubmissionService;
  private submissionFeatureService: SubmissionFeatureService;
  private quarantineService: QuarantineService;
  private regionService: RegionService;
  private objectStorageService: ObjectStorageService;
  private numFeaturesBatchSize: number;

  constructor(connection: IDBConnection) {
    super(connection);
    this.validationService = new ValidationService(connection);
    this.submissionService = new SubmissionService(connection);
    this.submissionFeatureService = new SubmissionFeatureService(connection);
    this.quarantineService = new QuarantineService(connection);
    this.regionService = new RegionService(connection);
    this.objectStorageService = new ObjectStorageService();

    const envBatchSize = Number(process.env.NUM_FEATURES_BATCH_SIZE);
    this.numFeaturesBatchSize =
      !isNaN(envBatchSize) && envBatchSize > 0 ? envBatchSize : DEFAULT_NUM_FEATURES_BATCH_SIZE;
  }

  /**
   * Validate that the submission record has a URI. Throw an error if the URI is missing
   *
   * @param {SubmissionRecord2} submission
   * @returns {SubmissionRecord2 & { uri: string }}
   */
  private _validateUri(submission: SubmissionRecord2): SubmissionRecord2 & { uri: string } {
    if (!submission.uri) {
      throw new ApiGeneralError('Submission URI does not exist.');
    }
    return submission as SubmissionRecord2 & { uri: string };
  }

  /**
   * Processes a submission that has already passed quarantine.
   *
   * @async
   * @param {number} submissionId
   * @returns {Promise<void>}
   * @throws {ApiGeneralError} If the submission record has no URI.
   * @throws {HTTP400} If the submission has no features or they are invalid.
   */
  async processSubmission(submissionId: number): Promise<void> {
    // Retrieve the submission record
    const submissionRecord = await this.submissionService.getSubmissionRecordBySubmissionId(submissionId);

    // Process the submission
    return this._processSubmission(submissionRecord);
  }

  /**
   * Parse and index features from a submission.
   *
   * 1. Verify that the submission has a valid `uri`.
   * 2. Download the quarantine tarball from object storage.
   * 3. Extract and validate the features JSON within the tarball.
   * 4. Index the features for search.
   * 5. Calculate and assign geographic regions for the quarantined submission.
   *
   * @param {SubmissionRecord2} submissionRecord
   * @returns {Promise<void>}
   * @throws {ApiGeneralError} If the submission record has no URI.
   * @throws {HTTP400} If the submission has no features or they are invalid.
   */
  private async _processSubmission(submissionRecord: SubmissionRecord2): Promise<void> {
    const submission = this._validateUri(submissionRecord);

    // 1. Get a stream for the tarball in object storage
    const tarballStream = await this.objectStorageService.getFileStream(BucketType.MAIN, submission.uri);

    // 2. Load entire features.json into memory
    const submissionFeatures = await extractFeaturesJsonFromStream(tarballStream);

    // 3. Process features in batches
    for (let i = 0; i < submissionFeatures.length; i += this.numFeaturesBatchSize) {
      const batch = submissionFeatures.slice(i, i + this.numFeaturesBatchSize);
      await this._processSubmissionFeatures(submission.submission_id, batch);
    }

    // 4. Calculate and add geographic regions
    await this.regionService.calculateAndAddRegionsForSubmission(submission.submission_id, 0.3);
  }

  /**
   * Processes features of a submission. Note that properties are not explicitly validated; the insert request will instead fail with invalid
   * properties for a feature.
   *
   * @param {number} submissionId
   * @param {ISubmissionFeature[]} features
   * @returns {Promise<void>}
   * @throws {ApiGeneralError} If the submission record has no URI.
   * @throws {HTTP400} If the submission has no features or they are invalid.
   */
  async _processSubmissionFeatures(submissionId: number, features: ISubmissionFeature[]): Promise<void> {
    // Step 1: Validate features using Zod/shape validation
    await this.validationService.validateSubmissionFeatureShape(features);

    // Normalize feature content
    const normalizedFeatures = await this.validationService.normalizeSubmissionFeature(features);

    // Step 2: Insert submission features recursively
    await this.submissionFeatureService.insertFeatureRecords(submissionId, normalizedFeatures, null);

    // Step 3. Insert the search keys for each feature
    await this.submissionFeatureService.indexSubmissionFeatures(submissionId);
  }

  /**
   * Processes a quarantined submission, skipping the malware scan
   *
   * @async
   * @param {string} quarantineId
   * @returns {Promise<void>}
   * @throws {ApiGeneralError} If the quarantined submission record has no URI.
   * @throws {HTTP400} If the quarantined submission has no features or they are invalid.
   */
  async processQuarantinedSubmission(quarantineId: string): Promise<void> {
    // Copy the quarantined submission object to the main bucket, skipping the malware scan
    const quarantine = await this.quarantineService.promoteQuarantineRecord(quarantineId);

    // Set the URI on the submission record
    const submission = await this.submissionService.updateSubmissionRecordByQuarantineId(quarantineId, {
      uri: quarantine.uri
    });

    return this._processSubmission(submission);
  }
}
