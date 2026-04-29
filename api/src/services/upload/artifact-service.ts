import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { Artifact, BatchUpdateArtifact, CreateArtifact, UpdateArtifact } from '../../models/artifact';
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
   * Bulk-look-up `byte_size` by `(bucket, object_key)`. See
   * `ArtifactRepository.getArtifactByteSizesByObjectKeys` for the why.
   *
   * @param {string} bucket
   * @param {string[]} objectKeys
   * @return {Promise<Map<string, number>>} object_key → byte_size
   * @memberof ArtifactService
   */
  async getArtifactByteSizesByObjectKeys(bucket: string, objectKeys: string[]): Promise<Map<string, number>> {
    return this.artifactRepository.getArtifactByteSizesByObjectKeys(bucket, objectKeys);
  }

  /**
   * Inserts a new artifact record.
   *
   * @param {CreateArtifact} artifact The artifact data to insert
   * @return {Promise<Artifact>} Persisted artifact row
   * @memberof ArtifactService
   */
  async insertArtifact(artifact: CreateArtifact): Promise<Artifact> {
    return this.artifactRepository.insertArtifact(artifact);
  }

  /**
   * Inserts artifact records in bulk.
   *
   * @param {CreateArtifact[]} artifacts
   * @returns {Promise<Artifact[]>}
   * @memberof ArtifactService
   */
  async insertArtifacts(artifacts: CreateArtifact[]): Promise<Artifact[]> {
    const seenKeys = new Set<string>();
    const duplicateKeys = new Set<string>();

    for (const artifact of artifacts) {
      const compositeKey = `${artifact.bucket}\0${artifact.object_key}`;
      if (seenKeys.has(compositeKey)) {
        duplicateKeys.add(`${artifact.bucket}/${artifact.object_key}`);
        continue;
      }

      seenKeys.add(compositeKey);
    }

    if (duplicateKeys.size > 0) {
      throw new ApiConflictError('Duplicate artifact keys in bulk insert payload', [
        'ArtifactService->insertArtifacts',
        { duplicateKeys: [...duplicateKeys] }
      ]);
    }

    return this.artifactRepository.insertArtifacts(artifacts);
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
   * Updates multiple artifacts by id.
   *
   * @param {BatchUpdateArtifact[]} artifacts Row-level updates keyed by artifact id
   * @return {Promise<{ artifact_id: string }[]>} Updated artifact IDs
   * @memberof ArtifactService
   */
  async updateArtifactsByIds(artifacts: BatchUpdateArtifact[]): Promise<{ artifact_id: string }[]> {
    return this.artifactRepository.updateArtifactsByIds(artifacts);
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
