import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { Artifact, ArtifactRepository } from '../repositories/artifact-repository';
import { SearchIndexRepository } from '../repositories/search-index-respository';
import { SecurityRepository } from '../repositories/security-repository';
import { SubmissionFeatureRecord } from '../repositories/submission-repository';
import { deleteFileFromS3, generateSubmissionFeatureS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { CodeService } from './code-service';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';

const defaultLog = getLogger('services/artifact-service');

/**
 * A service for maintaining submission artifacts.
 *
 * @export
 * @class ArtifactService
 */
export class ArtifactService extends DBService {
  artifactRepository: ArtifactRepository;
  submissionService: SubmissionService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.artifactRepository = new ArtifactRepository(connection);
    this.submissionService = new SubmissionService(connection);
  }

  /**
   * Inserts a new artifact record
   *
   * @param {IArtifact} artifact The artifact record to insert
   * @returns {*} {Promise<{ artifact_id: number }>} The ID of the inserted artifact
   * @memberof ArtifactService
   */
  async insertArtifactRecord(artifact: Artifact): Promise<{ artifact_id: number }> {
    return this.artifactRepository.insertArtifactRecord(artifact);
  }

  /**
   * Generates an S3 key for the artifact, uploads the file to S3, and persists the artifact key in the database.
   *
   * @param {string} artifactUploadKey
   * @param {Express.Multer.File} file
   * @return {*}  {Promise<SubmissionFeatureRecord>}
   * @memberof ArtifactService
   */
  async uploadSubmissionFeatureArtifact(
    artifactUploadKey: string,
    file: Express.Multer.File
  ): Promise<SubmissionFeatureRecord> {
    const artifactFeatureSubmission = await this.submissionService.getSubmissionFeatureByUuid(artifactUploadKey);

    // Generate S3 key
    const artifactS3Key = generateSubmissionFeatureS3FileKey({
      submissionId: artifactFeatureSubmission.submission_id,
      submissionFeatureId: artifactFeatureSubmission.submission_feature_id
    });

    defaultLog.debug({ label: 'uploadSubmissionFeatureArtifact', message: 'S3 key', artifactS3Key });

    // TODO add api codes cache: so lookups like this are fast (especially since codes dont change often)
    const codeService = new CodeService(this.connection);
    const artifactFeatureProperties = await codeService.getFeaturePropertyByName('artifact_key');

    const searchIndexRepository = new SearchIndexRepository(this.connection);

    // Insert S3 key in search string table
    await searchIndexRepository.insertSearchableStringRecords([
      {
        submission_feature_id: artifactFeatureSubmission.submission_feature_id,
        feature_property_id: artifactFeatureProperties.feature_property_id,
        value: artifactS3Key
      }
    ]);

    // Upload artifact to S3
    await uploadFileToS3(file, artifactS3Key, { filename: file.originalname });

    return artifactFeatureSubmission;
  }

  /**
   * Retrieves all artifacts belonging to the given dataset.
   *
   * @param {string} datasetId The ID of the dataset
   * @return {*}  {Promise<IArtifact[]>} All artifacts associated with the dataset
   * @memberof ArtifactService
   */
  async getArtifactsByDatasetId(datasetId: string): Promise<Artifact[]> {
    return this.artifactRepository.getArtifactsByDatasetId(datasetId);
  }

  /**
   * Retrieves an artifact by its primary key.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<Artifact>}
   * @memberof ArtifactService
   */
  async getArtifactById(artifactId: number): Promise<Artifact> {
    return this.artifactRepository.getArtifactById(artifactId);
  }

  /**
   * Fetches multiple artifact records by the given artifact IDs
   *
   * @param {number[]} artifactIds
   * @return {*}  {Promise<Artifact[]>}
   * @memberof ArtifactService
   */
  async getArtifactsByIds(artifactIds: number[]): Promise<Artifact[]> {
    return this.artifactRepository.getArtifactsByIds(artifactIds);
  }

  /**
   * updates the security review timestamp for an artifact
   *
   * @param {number} artifactId
   * @return {*}  {Promise<void>}
   * @memberof ArtifactService
   */
  async updateArtifactSecurityReviewTimestamp(artifactId: number): Promise<void> {
    defaultLog.debug({ label: 'updateArtifactSecurityReviewTimestamp' });

    await this.artifactRepository.updateArtifactSecurityReviewTimestamp(artifactId);
  }

  /**
   * Deletes multiple artifacts and their related S3 objects for a given list of UUIDs
   *
   * @param {string[]} uuids UUIDs of artifacts to delete
   */
  async deleteArtifacts(uuids: string[]): Promise<void> {
    defaultLog.debug({ label: 'deleteArtifacts' });

    try {
      for (const uuid of uuids) {
        await this.deleteArtifact(uuid);
      }
    } catch (error) {
      throw new ApiGeneralError(`There was an issue deleting an artifact.`);
    }
  }

  /**
   * Deletes an artifact and related S3 object for a given UUID
   *
   * @param {string} uuid UUID of artifact to delete
   */
  async deleteArtifact(uuid: string): Promise<void> {
    defaultLog.debug({ label: 'deleteArtifact' });

    try {
      const artifact = await this.artifactRepository.getArtifactByUUID(uuid);

      if (artifact) {
        const service = new SecurityRepository(this.connection);
        await service.deleteSecurityRulesForArtifactUUID(uuid);

        await this.artifactRepository.deleteArtifactByUUID(uuid);

        await deleteFileFromS3(artifact.key);
      }
    } catch (error) {
      throw new ApiGeneralError(`Issue deleting artifact: ${uuid}`);
    }
  }
}
