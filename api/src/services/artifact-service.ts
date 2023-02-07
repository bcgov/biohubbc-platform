import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { ArtifactRepository, IArtifact, IArtifactMetadata } from '../repositories/artifact-repository';
import { generateS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('services/artifact-service');

/**
 * A service for maintaining submission artifacts.
 * 
 * @export
 * @class ArtifactService
 */
export class ArtifactService extends DBService {
  artifactRepository: ArtifactRepository;
  submissionService: SubmissionService

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
  async getNextArtifactIds(count: number = 1): Promise<number[]> {
    return this.artifactRepository.getNextArtifactIds(count);
  }

  /**
   * Inserts a new artifact record
   *
   * @param {IArtifact} artifact The artifact record to insert
   * @returns {*} {Promise<{ artifact_id: number }>} The ID of the inserted artifact
   * @memberof ArtifactService
   */
  async insertArtifactRecord(artifact: IArtifact): Promise<{ artifact_id: number }> {
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
    metadata: IArtifactMetadata,
    fileUuid: string,
    file: Express.Multer.File
  ): Promise<{ artifact_id: number }> {
    defaultLog.debug({ label: 'uploadAndPersistArtifact' });

    // Fetch the source transform record for this submission based on the source system user id
    const sourceTransformRecord = await this.submissionService.getSourceTransformRecordBySystemUserId(
      this.connection.systemUserId()
    );

    if (!sourceTransformRecord) {
      throw new ApiGeneralError('Failed to get source transform record for system user');
    }

    // Create a new submission for the artifact collection
    const { submission_id } = await this.submissionService.getOrInsertSubmissionRecord({
      source_transform_id: sourceTransformRecord.source_transform_id,
      uuid: dataPackageId
    });
    
    // Retrieve the next artifact primary key assigned to this artifact once it is inserted
    const artifact_id = (await this.getNextArtifactIds())[0];      

    // Generate the S3 key for the artifact, using the preemptive artifact ID + the package UUID
    const s3Key = generateS3FileKey({
      uuid: dataPackageId,
      artifactId: artifact_id,
      fileName: file.originalname
    });    

    // Upload the artifact to S3
    await uploadFileToS3(file, s3Key, { filename: file.originalname });

    // If the file was successfully uploaded, we persist the artifact in the database
    const artifactInsertResponse = await this.insertArtifactRecord({
      ...metadata,
      artifact_id,
      submission_id,
      input_key: s3Key,
      uuid: fileUuid
    })

    return { artifact_id: artifactInsertResponse.artifact_id };
  }
}
