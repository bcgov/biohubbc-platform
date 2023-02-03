import { IDBConnection } from '../database/db';
import { ArtifactRepository, IGetArtifactMetadata } from '../repositories/artifact-repository';
import { DBService } from './db-service';
// import { getLogger } from '../utils/logger';

// const defaultLog = getLogger('services/artifact-service');

/**
 *
 * @export
 * @class ArtifactService
 */
export class ArtifactService extends DBService {
  artifactRepository: ArtifactRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.artifactRepository = new ArtifactRepository(connection);
  }

  async getNextArtifactId(): Promise<number> {
    return this.artifactRepository.getNextArtifactId();
  }

  async insertArtifactMetadata(artifactMetadata: IGetArtifactMetadata): Promise<{ artifact_id: number }> {
    return this.artifactRepository.insertArtifactMetadata(artifactMetadata);
  }
}
