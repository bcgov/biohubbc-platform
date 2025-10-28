import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { IDBConnection } from '../../database/db';
import { ApiGeneralError } from '../../errors/api-error';
import { IInsertQuarantine, IUpdateQuarantine, QuarantineRecord, QuarantineStatusEnum } from '../../models/quarantine';
import { QuarantineRepository } from '../../repositories/quarantine/quarantine-repository';
import { _getClamAvScanner } from '../../utils/file-utils';
import { DBService } from '../db-service';
import { QuarantineScanService } from './quarantine-scan-service';

export class QuarantineService extends DBService {
  quarantineRepository: QuarantineRepository;
  quarantineScanService: QuarantineScanService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.quarantineRepository = new QuarantineRepository(connection);
    this.quarantineScanService = new QuarantineScanService(connection);
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
   * Scans a quarantined file for malware using ClamAV.
   *
   * - Downloads the S3 object referenced by the quarantine record
   * - Streams or buffers it to ClamAV
   * - Updates the record status (CLEAN / INFECTED / ERROR)
   *
   * @param {string} quarantineId
   * @memberof QuarantineService
   */
  async scanQuarantineRecord(quarantineId: string): Promise<void> {
    const record = await this.getQuarantineRecord(quarantineId);

    if (!record.uri) {
      throw new ApiGeneralError(`Quarantine record ${quarantineId} has no URI`);
    }

    const match = record.uri.match(/^s3:\/\/([^/]+)\/(.+)$/);

    if (!match) {
      throw new ApiGeneralError(`Quarantine record URI is malformed: ${record.uri}`);
    }

    const [, Bucket, Key] = match;

    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const getObject = new GetObjectCommand({ Bucket, Key });

    await this.updateQuarantineRecord(quarantineId, {
      status: QuarantineStatusEnum.SCANNING
    });

    const response = await s3Client.send(getObject);
    const fileStream = response.Body as NodeJS.ReadableStream;

    const clam = await _getClamAvScanner();

    const { isInfected, viruses } = await clam.scanStream(fileStream);

    if (isInfected) {
      await this.updateQuarantineRecord(quarantineId, {
        status: QuarantineStatusEnum.INFECTED,
        scan_result: viruses?.join(', ') ?? 'Unknown virus'
      });
      return;
    }

    await this.updateQuarantineRecord(quarantineId, {
      status: QuarantineStatusEnum.CLEAN,
      scan_result: 'OK'
    });
  }
}
