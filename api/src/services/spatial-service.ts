import { IDBConnection } from '../database/db';
import {
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialComponent,
  SpatialRepository
} from '../repositories/spatial-repository';
import { DBService } from './db-service';

export class SpatialService extends DBService {
  spatialRepository: SpatialRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialRepository = new SpatialRepository(connection);
  }

  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponent[]> {
    return this.spatialRepository.findSpatialComponentsByCriteria(criteria);
  }
}
