import { IDBConnection } from '../database/db';
import { ArtifactRepository, IArtifact } from '../repositories/artifact-repository';
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

  async getNextArtifactIds(count: number = 1): Promise<{ uuid: string, artifact_id: number }[]> {
    return this.artifactRepository.getNextArtifactIds(count);
  }

  async insertArtifactRecord(artifact: IArtifact): Promise<{ artifact_id: number }> {
    return this.artifactRepository.insertArtifactRecord(artifact);
  }
}
