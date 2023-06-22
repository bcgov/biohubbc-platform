import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { Artifact, ArtifactMetadata, ArtifactRepository } from '../repositories/artifact-repository';
import { deleteFileFromS3, generateArtifactS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
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
   * Retrieves an array of of new primary keys for an artifact record.
   *
   * @param {number} [count=1] The number of artifact primary keys to generate (by default, only 1).
   * @returns {*} {Promise<number[]>} The array of artifact primary keys
   * @memberof ArtifactRepository
   */
  async getNextArtifactIds(count = 1): Promise<number[]> {
    return this.artifactRepository.getNextArtifactIds(count);
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
   * Generates an S3 key by the given data package UUID and artifact file, uploads the file to S3, and persists
   * the artifact in the database.
   *
   * @param {string} dataPackageId The submission UUID
   * @param {IArtifactMetadata} metadata Metadata object pertaining to the artifact
   * @param {string} fileUuid The UUID of the artifact
   * @param {Express.Multer.File} file The artifact file
   * @returns {*} {Promise<{ artifact_id: number }>} The primary key of the artifact upon insertion
   * @memberof ArtifactService
   */
  async uploadAndPersistArtifact(
    dataPackageId: string,
    metadata: ArtifactMetadata,
    fileUuid: string,
    file: Express.Multer.File
  ): Promise<{ artifact_id: number }> {
    defaultLog.debug({ label: 'uploadAndPersistArtifact' });

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    // Retrieve the next artifact primary key assigned to this artifact once it is inserted
    const artifact_id = (await this.getNextArtifactIds())[0];

    // Generate the S3 key for the artifact, using the preemptive artifact ID + the package UUID
    const s3Key = generateArtifactS3FileKey({
      datasetUUID: dataPackageId,
      artifactId: artifact_id,
      fileName: file.originalname
    });

    // Create a new submission for the artifact collection
    const { submission_id } = await this.submissionService.insertSubmissionRecordWithPotentialConflict({
      source_transform_id: sourceTransformRecord.source_transform_id,
      uuid: dataPackageId
    });

    // Upload the artifact to S3
    await uploadFileToS3(file, s3Key, { filename: file.originalname });

    // If the file was successfully uploaded, we persist the artifact in the database
    return this.insertArtifactRecord({
      ...metadata,
      artifact_id,
      submission_id,
      key: s3Key,
      uuid: fileUuid
    });
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
   * updates the security review timestamp for an artifact
   *
   * @param {number} artifactId
   * @return {*}  {Promise<void>}
   * @memberof ArtifactService
   */
  async updateArtifactSecurityReviewTimestamp(artifactId: number): Promise<void> {
    defaultLog.debug({ label: 'removeAllSecurityRulesFromArtifact' });

    await this.artifactRepository.updateArtifactSecurityReviewTimestamp(artifactId);
  }

  async deleteArtifacts(uuids: string[]): Promise<void> {
    try {
      for (const uuid of uuids) {
        await this.deleteArtifact(uuid);
      }
    } catch (error) {
      throw new ApiGeneralError(`There was an issue deleting an artifact.`);
    }
  }

  async deleteArtifact(uuid: string): Promise<void> {
    // need to get artifact key
    // delete from S3
    // delete from database
    const artifact = await this.artifactRepository.getArtifactByUUID(uuid);

    // tracking this to roll back incase of an error
    let deleteMarker: string | undefined;
    try {
      const deleteResponse = await deleteFileFromS3(artifact.key);
      deleteMarker = deleteResponse?.VersionId;
      await this.artifactRepository.deleteArtifactByUUID(uuid);
    } catch (error) {
      await deleteFileFromS3(artifact.key, deleteMarker);
      throw new ApiGeneralError(`Issue deleting artifact: ${uuid}`);
    }
  }
}
