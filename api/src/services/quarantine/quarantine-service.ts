import dayjs from 'dayjs';
import { Readable } from 'stream';
import * as tar from 'tar-stream';
import { IDBConnection } from '../../database/db';
import { ApiGeneralError } from '../../errors/api-error';
import { IInsertQuarantine, IUpdateQuarantine, QuarantineRecord, QuarantineStatusEnum } from '../../models/quarantine';
import { ScanStatusEnum } from '../../models/quarantine-scan';
import { FileScanResultEnum } from '../../models/quarantine-scan-file';
import { SubmissionRecordWithQuarantine } from '../../models/submission';
import { QuarantineRepository } from '../../repositories/quarantine/quarantine-repository';
import { _getClamAvScanner } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { QuarantineScanFileService } from './quarantine-scan-file-service';
import { QuarantineScanService } from './quarantine-scan-service';
import { IFinalizeScanParams, IScanSummary } from './quarantine-service.interface';

export class QuarantineService extends DBService {
  quarantineRepository: QuarantineRepository;
  quarantineScanService: QuarantineScanService;
  quarantineScanFileService: QuarantineScanFileService;
  objectStorageService: ObjectStorageService;
  quarantineBucketName: string;

  constructor(connection: IDBConnection) {
    super(connection);
    this.quarantineRepository = new QuarantineRepository(connection);
    this.quarantineScanService = new QuarantineScanService(connection);
    this.quarantineScanFileService = new QuarantineScanFileService(connection);
    this.objectStorageService = new ObjectStorageService();
    this.quarantineBucketName = process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME!;
  }

  /**
   * Get a quarantine record by its ID
   *
   * @param {string} quarantineId
   * @return {*}  {Promise<QuarantineRecord>}
   * @memberof QuarantineService
   */
  async getQuarantineRecord(quarantineId: string): Promise<QuarantineRecord> {
    return this.quarantineRepository.getQuarantineRecord(quarantineId);
  }

  /**
   * Get a quarantine record by its ID
   *
   * @return {*}  {Promise<SubmissionRecordWithQuarantine[]>}
   * @memberof QuarantineService
   */
  async getQuarantineRecordsWithScans(): Promise<SubmissionRecordWithQuarantine[]> {
    return this.quarantineRepository.getQuarantineRecordsWithScans();
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

  /**
   * Scans individual files within a tar stream for malware.
   *
   * @private
   * @param {NodeJS.ReadableStream} nodeStream - The tar stream to scan
   * @param {string} quarantineScanId - The quarantine scan ID for tracking results
   * @returns {Promise<IScanSummary>} Summary of scan results
   * @memberof QuarantineService
   */
  private async _scanTarStream(nodeStream: NodeJS.ReadableStream, quarantineScanId: string): Promise<IScanSummary> {
    const clam = await _getClamAvScanner();
    const extract = tar.extract();

    let hasInfection = false;
    const allViruses: string[] = [];
    let totalFiles = 0;
    let infectedCount = 0;

    const fileRecords: Array<{
      quarantine_scan_id: string;
      file_path: string;
      scan_result: FileScanResultEnum;
    }> = [];

    // Handle each file entry
    extract.on('entry', (header, stream, next) => {
      (async () => {
        try {
          totalFiles++;

          const realStream = Readable.from(stream);
          const { isInfected, viruses } = await clam.scanStream(realStream);
          const scanResult = isInfected ? FileScanResultEnum.INFECTED : FileScanResultEnum.CLEAN;

          fileRecords.push({
            quarantine_scan_id: quarantineScanId,
            file_path: header.name,
            scan_result: scanResult
          });

          if (isInfected) {
            hasInfection = true;
            infectedCount++;
            if (viruses) allViruses.push(...viruses);
          }
        } catch (err) {
          fileRecords.push({
            quarantine_scan_id: quarantineScanId,
            file_path: header.name,
            scan_result: FileScanResultEnum.ERROR
          });
        } finally {
          // Always drain the tar entry stream and continue
          stream.resume();
          next();
        }
      })();
    });

    // Wrap piping in a Promise instead of pipeline()
    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(extract);
      extract.on('finish', resolve);
      extract.on('error', reject);
      nodeStream.on('error', reject);
    });

    return {
      hasInfection,
      totalFiles,
      infectedCount,
      viruses: [...new Set(allViruses)],
      fileRecords
    };
  }

  /**
   * Finalizes the scan by inserting file records and updating scan/quarantine status.
   *
   * @private
   * @param {IFinalizeScanParams} params - Contains scan/quarantine IDs, summary, and scanner version
   * @memberof QuarantineService
   */
  private async _finalizeScanResults(params: IFinalizeScanParams): Promise<void> {
    const { quarantineScanId, quarantineId, scanSummary, scannerVersion } = params;

    // Batch insert all file records
    if (scanSummary.fileRecords.length > 0) {
      await this.quarantineScanFileService.insertQuarantineScanFileRecordBatch(scanSummary.fileRecords);
    }

    // Update scan record with results
    await this.quarantineScanService.updateQuarantineScanRecord(quarantineScanId, {
      results: {
        total_files: scanSummary.totalFiles,
        infected_files: scanSummary.infectedCount,
        viruses: scanSummary.viruses
      },
      scanner_version: scannerVersion,
      scan_status: ScanStatusEnum.COMPLETED,
      scanned_at: dayjs().toISOString()
    });

    // Update quarantine record status
    await this.updateQuarantineRecord(quarantineId, {
      status: scanSummary.hasInfection ? QuarantineStatusEnum.INFECTED : QuarantineStatusEnum.CLEAN
    });
  }

  /**
   * Scans a quarantined file for malware using ClamAV.
   *
   * - Downloads the S3 object referenced by the quarantine record
   * - Extracts files from the tarball and scans each individually
   * - Updates the record status
   *
   * @param {string} quarantineId - The quarantine record ID to scan
   * @throws {ApiGeneralError} If URI is invalid or scan fails
   * @memberof QuarantineService
   */
  async scanQuarantineRecord(quarantineId: string): Promise<void> {
    // 1. Validate and extract S3 location
    const record = await this.getQuarantineRecord(quarantineId);

    // 2. Create scan record
    const scan = await this.quarantineScanService.insertQuarantineScanRecord({
      quarantine_id: quarantineId,
      scan_status: ScanStatusEnum.SCANNING,
      scanned_at: dayjs().toISOString()
    });

    // 3. Download file from S3
    const nodeStream = await this.objectStorageService.getFileStream(BucketType.QUARANTINE, record.uri);

    // 4. Get scanner version
    const clam = await _getClamAvScanner();
    const scannerVersion = await clam.getVersion();

    // 5. Scan the tar stream
    const scanSummary = await this._scanTarStream(nodeStream, scan.quarantine_scan_id);

    // 6. Finalize results
    await this._finalizeScanResults({
      quarantineScanId: scan.quarantine_scan_id,
      quarantineId,
      scanSummary,
      scannerVersion
    });

    // 7. Copy the submission from the quarantined bucket to the main bucket
    await this.objectStorageService.promoteFromQuarantine(record.uri);
  }

  /**
   * Promotes a quarantined file to the main bucket without scanning.
   *
   * - Copies the S3 object from the quarantine bucket to the main bucket
   * - Updates the record status to APPROVED or ACTIVE
   *
   * @param {string} quarantineId - The quarantine record ID to promote
   * @throws {ApiGeneralError} If the record or URI is invalid
   * @returns {Promise<QuarantineRecord>}
   * @memberof QuarantineService
   */
  async promoteQuarantineRecord(quarantineId: string): Promise<QuarantineRecord> {
    // 1. Validate and get quarantine record
    const record = await this.getQuarantineRecord(quarantineId);

    if (!record.uri) {
      throw new ApiGeneralError('Quarantine record URI does not exist.');
    }

    // 2. Copy the file from quarantine to main bucket
    await this.objectStorageService.promoteFromQuarantine(record.uri);

    // 3. Update the record status to indicate it is now active/approved
    await this.updateQuarantineRecord(quarantineId, { status: QuarantineStatusEnum.SKIPPED });

    return record;
  }
}
