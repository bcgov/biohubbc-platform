import { IDBConnection } from '../database/db';
import {
  AdministrativeRepository,
  IAdministrativeActivity,
  ICreateAdministrativeActivity
} from '../repositories/administrative-repository';
import { DBService } from './db-service';

export class AdministrativeService extends DBService {
  administrativeRepository: AdministrativeRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.administrativeRepository = new AdministrativeRepository(connection);
  }

  /**
   * Get all Administrative Activities
   *
   * @param {string} administrativeActivityTypeName
   * @param {string[]} administrativeActivityStatusTypes
   * @return {*}  {Promise<IAdministrativeActivity[]>}
   * @memberof AdministrativeService
   */
  async getAdministrativeActivities(
    administrativeActivityTypeName: string,
    administrativeActivityStatusTypes: string[]
  ): Promise<IAdministrativeActivity[]> {
    return this.administrativeRepository.getAdministrativeActivities(
      administrativeActivityTypeName,
      administrativeActivityStatusTypes
    );
  }

  /**
   * Create Administrative Activity
   *
   * @param {number} systemUserId
   * @param {*} data
   * @return {*}  {Promise<ICreateAdministrativeActivity>}
   * @memberof AdministrativeService
   */
  async createAdministrativeActivity(systemUserId: number, data: any): Promise<ICreateAdministrativeActivity> {
    return this.administrativeRepository.createAdministrativeActivity(systemUserId, data);
  }

  /**
   * Get count of pending access requests
   *
   * @param {string} userIdentifier
   * @return {*}  {Promise<number>}
   * @memberof AdministrativeService
   */
  async getPendingAccessRequestCount(userIdentifier: string): Promise<number> {
    return this.administrativeRepository.getPendingAccessRequestCount(userIdentifier);
  }

  /**
   * Update an existing administrative activity.
   *
   * @param {number} administrativeActivityId
   * @param {number} administrativeActivityStatusTypeId
   * @param {IDBConnection} connection
   */
  async updateAdministrativeActivity(
    administrativeActivityId: number,
    administrativeActivityStatusTypeId: number
  ): Promise<{ id: number }> {
    return this.administrativeRepository.updateAdministrativeActivity(
      administrativeActivityId,
      administrativeActivityStatusTypeId
    );
  }
}
