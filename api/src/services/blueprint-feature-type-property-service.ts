import { IDBConnection } from '../database/db';
import { BlueprintFeatureTypePropertyRepository } from '../repositories/blueprint-feature-type-property-repository';
import { DBService } from './db-service';

/**
 * Own blueprint-specific property membership persistence.
 */
export class BlueprintFeatureTypePropertyService extends DBService {
  blueprintFeatureTypePropertyRepository: BlueprintFeatureTypePropertyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.blueprintFeatureTypePropertyRepository = new BlueprintFeatureTypePropertyRepository(connection);
  }

  /**
   * Delete active children before deleting their parent in the same transaction.
   *
   * @param blueprintFeatureTypeId Validated parent assignment.
   * @param date Database date shared with parent deletion.
   * @returns Resolves after persistence.
   */
  async deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(blueprintFeatureTypeId: number, date: string) {
    await this.blueprintFeatureTypePropertyRepository.deleteBlueprintFeatureTypePropertiesByBlueprintFeatureTypeId(
      blueprintFeatureTypeId,
      date
    );
  }
}
