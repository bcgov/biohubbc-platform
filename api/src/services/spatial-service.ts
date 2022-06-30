import { IDBConnection } from '../database/db';
import {
  ISpatialComponentsSearchCriteria,
  ISubmissionSpatialComponent,
  ISubmissionSpatialComponentsCluster,
  SpatialRepository
} from '../repositories/spatial-repository';
import { DBService } from './db-service';

export class SpatialService extends DBService {
  spatialRepository: SpatialRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialRepository = new SpatialRepository(connection);
  }

  async getSpatialComponentsCountByCriteria(criteria: ISpatialComponentsSearchCriteria): Promise<{ count: number }> {
    return this.spatialRepository.getSpatialComponentsCountByCriteria(criteria);
  }

  async findSpatialComponentsByCriteria(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponent[]> {
    return this.spatialRepository.findSpatialComponentsByCriteria(criteria);
  }

  async findSpatialComponentsByCriteriaWithClustering(
    criteria: ISpatialComponentsSearchCriteria
  ): Promise<ISubmissionSpatialComponentsCluster[]> {
    return this.spatialRepository.findSpatialComponentsByCriteriaWithClustering(criteria);
  }
}
