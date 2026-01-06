import { IDBConnection } from '../../database/db';
import {
  ArtifactQuarantine,
  CreateArtifactQuarantine,
  UpdateArtifactQuarantine
} from '../../models/artifact-quarantine';
import { ArtifactQuarantineRepository } from '../../repositories/upload/artifact-quarantine-repository';
import { DBService } from '../db-service';

export class ArtifactQuarantineService extends DBService {
  uploadArtifactQuarantineRepository: ArtifactQuarantineRepository;

  /**
   * Creates an instance of ArtifactQuarantineService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactQuarantineService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactQuarantineRepository = new ArtifactQuarantineRepository(connection);
  }

  /**
   * Retrieves a single upload artifact quarantine record by its ID.
   *
   * @param {string} quarantineId The ID of the quarantine record
   * @return {Promise<ArtifactQuarantine>} The upload artifact quarantine record
   * @memberof ArtifactQuarantineService
   */
  async getArtifactQuarantine(quarantineId: string): Promise<ArtifactQuarantine> {
    return this.uploadArtifactQuarantineRepository.getArtifactQuarantine(quarantineId);
  }

  /**
   * Inserts a new upload artifact quarantine record.
   *
   * @param {CreateArtifactQuarantine} quarantine The data for the new quarantine record
   * @return {Promise<{ quarantine_id: string }>} The newly created quarantine record ID
   * @memberof ArtifactQuarantineService
   */
  async insertArtifactQuarantine(quarantine: CreateArtifactQuarantine): Promise<{ quarantine_id: string }> {
    return this.uploadArtifactQuarantineRepository.insertArtifactQuarantine(quarantine);
  }

  /**
   * Updates an existing upload artifact quarantine record by ID.
   *
   * @param {string} quarantineId The ID of the quarantine record to update
   * @param {UpdateArtifactQuarantine} quarantine The fields to update
   * @return {Promise<{ quarantine_id: string }>} The updated quarantine record ID
   * @memberof ArtifactQuarantineService
   */
  async updateArtifactQuarantine(
    quarantineId: string,
    quarantine: UpdateArtifactQuarantine
  ): Promise<{ quarantine_id: string }> {
    return this.uploadArtifactQuarantineRepository.updateArtifactQuarantine(quarantineId, quarantine);
  }
}
