import { IDBConnection } from '../../database/db';
import { Artifact, CreateArtifact, UpdateArtifact } from '../../models/artifact';
import { ArtifactRepository } from '../../repositories/upload/artifact-repository';
import { DBService } from '../db-service';

export class ArtifactService extends DBService {
  artifactRepository: ArtifactRepository;

  /**
   * Creates an instance of ArtifactService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.artifactRepository = new ArtifactRepository(connection);
  }

  /**
   * Retrieves a single artifact record by its ID.
   *
   * @param {string} artifactId The ID of the artifact
   * @return {Promise<Artifact>} The artifact record
   * @memberof ArtifactService
   */
  async getArtifact(artifactId: string): Promise<Artifact> {
    return this.artifactRepository.getArtifact(artifactId);
  }

  /**
   * Retrieves all artifact records.
   *
   * @return {Promise<Artifact[]>} Array of all artifacts
   * @memberof ArtifactService
   */
  async getArtifacts(): Promise<Artifact[]> {
    return this.artifactRepository.getArtifacts();
  }

  /**
   * Inserts a new artifact record.
   *
   * @param {CreateArtifact} artifact The artifact data to insert
   * @return {Promise<{ artifact_id: string }>} Newly created artifact ID
   * @memberof ArtifactService
   */
  async insertArtifact(artifact: CreateArtifact): Promise<{ artifact_id: string }> {
    return this.artifactRepository.insertArtifact(artifact);
  }

  /**
   * Updates an existing artifact record by ID.
   *
   * @param {string} artifactId The ID of the artifact to update
   * @param {UpdateArtifact} artifact Fields to update
   * @return {Promise<{ artifact_id: string }>} Updated artifact ID
   * @memberof ArtifactService
   */
  async updateArtifact(artifactId: string, artifact: UpdateArtifact): Promise<{ artifact_id: string }> {
    return this.artifactRepository.updateArtifact(artifactId, artifact);
  }

  /**
   * Updates all artifacts associated with a given upload archive ID.
   *
   * @param {string} uploadId The upload ID whose artifacts will be updated
   * @param {UpdateArtifact} artifact Fields to update
   * @return {Promise<{artifact_id: string}[]>} Updated artifact IDs (may be multiple)
   * @memberof ArtifactService
   */
  async updateArtifactsByUploadId(uploadId: string, artifact: UpdateArtifact): Promise<{ artifact_id: string }[]> {
    return this.artifactRepository.updateArtifactsByUploadId(uploadId, artifact);
  }

  /**
   * Deletes an artifact record by ID.
   *
   * @param {string} artifactId The ID of the artifact to delete
   * @return {Promise<void>}
   * @memberof ArtifactService
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    return this.artifactRepository.deleteArtifact(artifactId);
  }
}
