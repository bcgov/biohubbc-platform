import { IDBConnection } from '../../database/db';
import {
  IInsertQuarantineScanFile,
  IUpdateQuarantineScanFile,
  QuarantineScanFileRecord
} from '../../models/quarantine-scan-file';
import { QuarantineScanFileRepository } from '../../repositories/quarantine/quarantine-scan-file-repository';
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
   * @param {IInsertQuarantineScanFile} quarantineScanFile
   * @return {*}  {Promise<{ quarantine_scan_file_id: string }>}
   * @memberof QuarantineScanFileService
   */
  async insertQuarantineScanFileRecord(
    quarantineScanFile: IInsertQuarantineScanFile
  ): Promise<{ quarantine_scan_file_id: string }> {
    return this.quarantineScanFileRepository.insertQuarantineScanFileRecord(quarantineScanFile);
  }

  /**
   * Insert a new quarantineScanFile record.
   *
   * @param {IInsertQuarantineScanFile[]} quarantineScanFile
   * @return {*}  {Promise<{ quarantine_scan_file_id: string }[]>}
   * @memberof QuarantineScanFileService
   */
  async insertQuarantineScanFileRecordBatch(
    quarantineScanFile: IInsertQuarantineScanFile[]
  ): Promise<{ quarantine_scan_file_id: string }[]> {
    return this.quarantineScanFileRepository.insertQuarantineScanFileRecordBatch(quarantineScanFile);
  }

  /**
   * Update an existing quarantineScanFile record.
   *
   * @param {string} quarantineScanFileId
   * @param {IUpdateQuarantineScanFile} quarantineScanFile
   * @return {*}  {Promise<{ quarantine_scan_file_id: string }>}
   * @memberof QuarantineScanFileService
   */
  async updateQuarantineScanFileRecord(
    quarantineScanFileId: string,
    quarantineScanFile: IUpdateQuarantineScanFile
  ): Promise<{ quarantine_scan_file_id: string }> {
    return this.quarantineScanFileRepository.updateQuarantineScanFileRecord(quarantineScanFileId, quarantineScanFile);
  }
}
