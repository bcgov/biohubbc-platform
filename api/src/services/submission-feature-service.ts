import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import {
  ISubmissionFeature,
  SubmissionFeatureRecordWithTypeAndSecurity,
  SubmissionFeatureSignedUrlPayload,
  SubmissionRepository
} from '../repositories/submission-repository';
import { getS3SignedURL } from '../utils/file-utils';
import { DBService } from './db-service';
import { SearchIndexService } from './search-index-service';

export class SubmissionFeatureService extends DBService {
  private readonly submissionRepository: SubmissionRepository;
  private readonly searchIndexService: SearchIndexService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.searchIndexService = new SearchIndexService(connection);
  }

  /**
   * Recursively insert submission features while preserving parent-child relationships.
   *
   * @param {number} submissionId
   * @param {ISubmissionFeature[]} features
   * @param {(number | null)} parentId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionFeatureService
   */
  async insertFeatureRecords(
    submissionId: number,
    features: ISubmissionFeature[],
    parentId: number | null
  ): Promise<void> {
    for (const feature of features) {
      const inserted = await this.submissionRepository.insertSubmissionFeatureRecord(
        submissionId,
        parentId,
        feature.id,
        feature.type,
        feature.properties
      );

      if (feature.child_features?.length) {
        await this.insertFeatureRecords(submissionId, feature.child_features, inserted.submission_feature_id);
      }
    }
  }

  /**
   * Index submission features for a given submission.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionFeatureService
   */
  async indexSubmissionFeatures(submissionId: number): Promise<void> {
    await this.searchIndexService.indexFeaturesBySubmissionId(submissionId);
  }

  /**
   * Generate a signed URL for a submission feature artifact.
   *
   * @param {SubmissionFeatureSignedUrlPayload} payload
   * @throws {ApiGeneralError} if signed URL cannot be generated
   * @return {*}  {Promise<string>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureSignedUrl(payload: SubmissionFeatureSignedUrlPayload): Promise<string> {
    const artifactKey = payload.isAdmin
      ? await this.submissionRepository.getAdminSubmissionFeatureArtifactKey(payload)
      : await this.submissionRepository.getSubmissionFeatureArtifactKey(payload);

    const signedUrl = await getS3SignedURL(artifactKey);

    if (!signedUrl) {
      throw new ApiGeneralError(
        `Failed to generate signed URL for "${payload.submissionFeatureObj.key}":"${payload.submissionFeatureObj.value}"`,
        ['SubmissionFeatureService->getSubmissionFeatureSignedUrl', 'getS3SignedURL returned null']
      );
    }

    return signedUrl;
  }

  /**
   * Retrieve submission features by submission ID, optionally with search key values applied.
   *
   * @param {number} submissionId
   * @param {boolean} [withSearchKeys=false] If true, attach search key values to each feature
   * @return {*}  {Promise<SubmissionFeatureRecordWithTypeAndSecurity[]>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatures(
    submissionId: number,
    withSearchKeys: boolean = false
  ): Promise<SubmissionFeatureRecordWithTypeAndSecurity[]> {
    const features = await this.submissionRepository.getSubmissionFeaturesBySubmissionId(submissionId);

    if (!withSearchKeys) {
      return features;
    }

    const searchKeyValues = await this.searchIndexService.getSearchKeyValuesBySubmissionId(submissionId);

    return features.map((feature) => {
      const data = searchKeyValues
        .filter((kv) => kv.submission_feature_id === feature.submission_feature_id)
        .reduce((acc, kv) => ({ ...acc, [kv.feature_property_name]: kv.value }), {});
      return { ...feature, data };
    });
  }
}
