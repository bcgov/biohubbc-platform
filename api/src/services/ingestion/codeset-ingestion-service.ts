import { IDBConnection } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateContributorCodeset } from '../../models/contributor-codeset';
import { CreateContributorCodesetCode } from '../../models/contributor-codeset-code';
import { streamCodesetsFromTarball } from '../../utils/biohub-tar-parser';
import { ContributorCodesetCodeService } from '../contributor-codeset-code-service';
import { ContributorCodesetService } from '../contributor-codeset-service';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import type { TarCodesets } from './submission-ingestion-codes-service.interface';

const CONTRIBUTOR_CODE_INSERT_BATCH_SIZE = 10000;

/**
 * Ingest contributor codesets/codes parsed from tarball entries.
 */
export class CodesetIngestionService extends DBService {
  objectStorageService = new ObjectStorageService();
  contributorService = new ContributorService(this.connection);
  contributorCodesetService = new ContributorCodesetService(this.connection);
  contributorCodesetCodeService = new ContributorCodesetCodeService(this.connection);

  constructor(connection: IDBConnection) {
    super(connection);
  }

  /**
   * Stream codeset JSON payloads from the tarball and persist contributor codesets/codes as they are read.
   *
   * @param {string} objectKey
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   */
  async ingestCodesetsFromTarball(objectKey: string, submissionUploadId: string): Promise<void> {
    const contributor = await this.contributorService.getContributorBySubmissionUploadId(submissionUploadId);
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);

    await streamCodesetsFromTarball(tarStream, async (codesets) => {
      await this.persistContributorCodesets(contributor.contributor_id, codesets);
    });
  }

  /**
   * Persist contributor codeset/codes rows for one parsed codeset payload.
   *
   * @private
   * @param {number} contributorId
   * @param {TarCodesets} codesets
   * @return {Promise<void>}
   */
  private async persistContributorCodesets(contributorId: number, codesets: TarCodesets): Promise<void> {
    for (const [codesetKey, rawCodeset] of Object.entries(codesets)) {
      if (!rawCodeset || typeof rawCodeset !== 'object') {
        throw new ApiExecuteSQLError('Invalid codeset payload', [
          'CodesetIngestionService->persistContributorCodesets',
          { codesetKey }
        ]);
      }

      if (typeof rawCodeset.label !== 'string' || !rawCodeset.label.trim()) {
        throw new ApiExecuteSQLError('Codeset label is required', [
          'CodesetIngestionService->persistContributorCodesets',
          { codesetKey }
        ]);
      }

      const contributorCodesetPayload: CreateContributorCodeset = {
        contributor_id: contributorId,
        key: codesetKey,
        external_id:
          typeof rawCodeset.external_id === 'string' && rawCodeset.external_id.trim()
            ? rawCodeset.external_id.trim()
            : null,
        label: rawCodeset.label.trim().toLowerCase(),
        description:
          typeof rawCodeset.description === 'string' && rawCodeset.description.trim()
            ? rawCodeset.description.trim().toLowerCase()
            : null
      };

      const contributorCodeset = await this.contributorCodesetService.createCodeset(contributorCodesetPayload);
      const rawCodes = rawCodeset.codes ?? {};
      const contributorCodesetCodePayloads: CreateContributorCodesetCode[] = [];

      for (const [codeKey, rawCode] of Object.entries(rawCodes)) {
        if (!rawCode || typeof rawCode !== 'object') {
          throw new ApiExecuteSQLError('Invalid codeset code payload', [
            'CodesetIngestionService->persistContributorCodesets',
            { codesetKey, codeKey }
          ]);
        }

        if (typeof rawCode.label !== 'string' || !rawCode.label.trim()) {
          throw new ApiExecuteSQLError('Code label is required', [
            'CodesetIngestionService->persistContributorCodesets',
            { codesetKey, codeKey }
          ]);
        }

        contributorCodesetCodePayloads.push({
          contributor_codeset_id: contributorCodeset.contributor_codeset_id,
          key: codeKey,
          external_id:
            typeof rawCode.external_id === 'string' && rawCode.external_id.trim() ? rawCode.external_id.trim() : null,
          label: rawCode.label.trim().toLowerCase(),
          description:
            typeof rawCode.description === 'string' && rawCode.description.trim()
              ? rawCode.description.trim().toLowerCase()
              : null
        });
      }

      if (contributorCodesetCodePayloads.length) {
        for (
          let index = 0;
          index < contributorCodesetCodePayloads.length;
          index += CONTRIBUTOR_CODE_INSERT_BATCH_SIZE
        ) {
          const currentBatch = contributorCodesetCodePayloads.slice(index, index + CONTRIBUTOR_CODE_INSERT_BATCH_SIZE);
          await this.contributorCodesetCodeService.createContributorCodesetCodes(currentBatch);
        }
      }
    }
  }
}
