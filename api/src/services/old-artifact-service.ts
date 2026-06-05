import { IDBConnection } from '../database/db';
import { ApiError, ApiGeneralError } from '../errors/api-error';
import { Artifact, ArtifactRepository } from '../repositories/artifact-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { deleteFileFromS3 } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/artifact-service');

/**
 * A service for maintaining submission artifacts.
 *
 * @export
 * @class ArtifactService
 */
export class ArtifactService extends DBService {
  artifactRepository: ArtifactRepository;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static readonly dependencies = {
    deleteFileFromS3
  };

  constructor(connection: IDBConnection) {
    super(connection);

    this.artifactRepository = new ArtifactRepository(connection);
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
      throw new ApiGeneralError(`There was an issue deleting an artifact.`, [error as ApiError]);
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

        await ArtifactService.dependencies.deleteFileFromS3(artifact.key);
      }
    } catch (error) {
      throw new ApiGeneralError(`Issue deleting artifact: ${uuid}`, [error as ApiError]);
    }
  }
}
