import { IDBConnection } from '../database/db';
import { FeatureTypePropertyFeatureRepository } from '../repositories/feature-type-property-feature-repository';
import { DBService } from './db-service';

/**
 * Own allowed reference targets configured on blueprint property assignments.
 */
export class FeatureTypePropertyFeatureService extends DBService {
  featureTypePropertyFeatureRepository: FeatureTypePropertyFeatureRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.featureTypePropertyFeatureRepository = new FeatureTypePropertyFeatureRepository(connection);
  }

  /**
   * Copy active reference targets onto a new blueprint's corresponding property assignments.
   *
   * @param sourceBlueprintId Blueprint supplying the reference configuration.
   * @param blueprintId New blueprint whose assignments have already been copied.
   * @returns Resolves after reference targets are copied.
   */
  async copyBlueprintReferenceTargets(sourceBlueprintId: number, blueprintId: number): Promise<void> {
    await this.featureTypePropertyFeatureRepository.copyBlueprintReferenceTargets(sourceBlueprintId, blueprintId);
  }
}
