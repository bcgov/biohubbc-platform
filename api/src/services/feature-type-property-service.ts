import { IDBConnection } from '../database/db';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/feature-type-property');

export class FeatureTypePropertyService extends DBService {
  featureTypePropertyRepository: FeatureTypePropertyRepository;

  /**
   * Build a feature-type-property service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.featureTypePropertyRepository = new FeatureTypePropertyRepository(connection);
  }

  /**
   * Get a feature property record by canonical feature-property name.
   *
   * @param {string} featurePropertyName - Canonical feature-property name.
   * @return {Promise<FeatureTypeProperty>} Matched feature-type-property row.
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeatureTypeProperty> {
    defaultLog.debug({ message: 'getFeaturePropertyByName' });

    return this.featureTypePropertyRepository.getFeaturePropertyByName(featurePropertyName);
  }

  /**
   * Get a feature property record by feature_type_property_id.
   *
   * @param {number} featureTypePropertyId - Feature type property identifier.
   * @return {Promise<FeatureTypeProperty>} Matched feature-type-property row.
   */
  async getFeaturePropertyByFeatureTypePropertyId(featureTypePropertyId: number): Promise<FeatureTypeProperty> {
    defaultLog.debug({ message: 'getFeaturePropertyByFeatureTypePropertyId' });

    return this.featureTypePropertyRepository.getFeaturePropertyByFeatureTypePropertyId(featureTypePropertyId);
  }
}
