import { IDBConnection } from '../../database/db';
import { IInsertQuarantine, IUpdateQuarantine } from '../../models/quarantine';
import { QuarantineScanFileRecord } from '../../models/quarantine-scan-file';
import { DBService } from '../db-service';

export class QuarantineScanFileService extends DBService {
  quarantineScanFileRepository: QuarantineScanFileRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.quarantineScanFileRepository = new QuarantineScanFileRepository(connection);
  }

  /**
   * Get a quarantineScanFile record by its ID
   *
   * @param {string} quarantineScanFileId
   * @return {*}  {Promise<QuarantineScanFileRecord>}
   * @memberof QuarantineScanFileService
   */
  async getQuarantineScanFileRecord(quarantineScanFileId: string): Promise<QuarantineScanFileRecord> {
    return this.quarantineScanFileRepository.getQuarantineScanFileRecord(quarantineScanFileId);
  }

  /**
   * Insert a new quarantineScanFile record.
   *
   * @param {IInsertQuarantine} quarantineScanFile
   * @return {*}  {Promise<{ quarantine_scan_file_id: string }>}
   * @memberof QuarantineScanFileService
   */
  async insertQuarantineScanFileRecord(
    quarantineScanFile: IInsertQuarantine
  ): Promise<{ quarantine_scan_file_id: string }> {
    return this.quarantineScanFileRepository.insertQuarantineScanFileRecord(quarantineScanFile);
  }

  /**
   * Update an existing quarantineScanFile record.
   *
   * @param {string} quarantineScanFileId
   * @param {IUpdateQuarantine} quarantineScanFile
   * @return {*}  {Promise<{ quarantine_scan_file_id: string }>}
   * @memberof QuarantineScanFileService
   */
  async updateQuarantineScanFileRecord(
    quarantineScanFileId: string,
    quarantineScanFile: IUpdateQuarantine
  ): Promise<{ quarantine_scan_file_id: string }> {
    return this.quarantineScanFileRepository.updateQuarantineScanFileRecord(quarantineScanFileId, quarantineScanFile);
  }
}
