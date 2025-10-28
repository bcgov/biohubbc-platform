import { IDBConnection } from '../database/db';
import { IInsertQuarantine, IUpdateQuarantine } from '../models/quarantine';
import { QuarantineRepository } from '../repositories/quarantine-repository';
import { DBService } from './db-service';

export class QuarantineService extends DBService {
  quarantineRepository: QuarantineRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.quarantineRepository = new QuarantineRepository(connection);
  }

  /**
   * Insert a new quarantine record.
   *
   * @param {IInsertQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineService
   */
  async insertQuarantineRecord(quarantine: IInsertQuarantine): Promise<{ quarantine_id: string }> {
    return this.quarantineRepository.insertQuarantineRecord(quarantine);
  }

  /**
   * Update an existing quarantine record.
   *
   * @param {string} quarantineId
   * @param {IUpdateQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineService
   */
  async updateQuarantineRecord(
    quarantineId: string,
    quarantine: IUpdateQuarantine
  ): Promise<{ quarantine_id: string }> {
    return this.quarantineRepository.updateQuarantineRecord(quarantineId, quarantine);
  }
}
