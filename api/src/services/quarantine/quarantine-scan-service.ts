import { IDBConnection } from '../../database/db';
import { DBService } from '../db-service';
import { IInsertQuarantine, IUpdateQuarantine, QuarantineScanRecord } from '../models/quarantineScan';

export class QuarantineScanService extends DBService {
  quarantineScanRepository: QuarantineScanRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.quarantineScanRepository = new QuarantineScanRepository(connection);
  }

  /**
   * Get a quarantineScan record by its ID
   *
   * @param {string} quarantineScanId
   * @return {*}  {Promise<QuarantineScanRecord>}
   * @memberof QuarantineScanService
   */
  async getQuarantineScanRecord(quarantineScanId: string): Promise<QuarantineScanRecord> {
    return this.quarantineScanRepository.getQuarantineScanRecord(quarantineScanId);
  }

  /**
   * Insert a new quarantineScan record.
   *
   * @param {IInsertQuarantine} quarantineScan
   * @return {*}  {Promise<{ quarantine_scan_id: string }>}
   * @memberof QuarantineScanService
   */
  async insertQuarantineScanRecord(quarantineScan: IInsertQuarantine): Promise<{ quarantine_scan_id: string }> {
    return this.quarantineScanRepository.insertQuarantineScanRecord(quarantineScan);
  }

  /**
   * Update an existing quarantineScan record.
   *
   * @param {string} quarantineScanId
   * @param {IUpdateQuarantine} quarantineScan
   * @return {*}  {Promise<{ quarantine_scan_id: string }>}
   * @memberof QuarantineScanService
   */
  async updateQuarantineScanRecord(
    quarantineScanId: string,
    quarantineScan: IUpdateQuarantine
  ): Promise<{ quarantine_scan_id: string }> {
    return this.quarantineScanRepository.updateQuarantineScanRecord(quarantineScanId, quarantineScan);
  }
}
