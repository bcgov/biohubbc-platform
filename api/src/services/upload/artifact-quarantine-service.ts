import { IDBConnection } from '../../database/db';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { DBService } from '../db-service';

export class ArtifactSecurityService extends DBService {
  uploadArtifactSecurityRepository: ArtifactSecurityRepository;

  /**
   * Creates an instance of ArtifactSecurityService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactSecurityService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactSecurityRepository = new ArtifactSecurityRepository(connection);
  }

  /**
   * Retrieves a single upload artifact security record by its ID.
   *
   * @param {string} securityId The ID of the security record
   * @return {Promise<ArtifactSecurity>} The upload artifact security record
   * @memberof ArtifactSecurityService
   */
  async getArtifactSecurity(securityId: string): Promise<ArtifactSecurity> {
    return this.uploadArtifactSecurityRepository.getArtifactSecurity(securityId);
  }

  /**
   * Inserts a new upload artifact security record.
   *
   * @param {CreateArtifactSecurity} security The data for the new security record
   * @return {Promise<{ security_id: string }>} The newly created security record ID
   * @memberof ArtifactSecurityService
   */
  async insertArtifactSecurity(security: CreateArtifactSecurity): Promise<{ security_id: string }> {
    return this.uploadArtifactSecurityRepository.insertArtifactSecurity(security);
  }

  /**
   * Updates an existing upload artifact security record by ID.
   *
   * @param {string} securityId The ID of the security record to update
   * @param {UpdateArtifactSecurity} security The fields to update
   * @return {Promise<{ security_id: string }>} The updated security record ID
   * @memberof ArtifactSecurityService
   */
  async updateArtifactSecurity(securityId: string, security: UpdateArtifactSecurity): Promise<{ security_id: string }> {
    return this.uploadArtifactSecurityRepository.updateArtifactSecurity(securityId, security);
  }
}
