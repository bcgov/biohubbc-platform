import { IDBConnection } from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { CreateContributorCodeset } from '../../models/contributor-codeset';
import { CreateContributorCodesetCode } from '../../models/contributor-codeset-code';
import { streamCodesets } from '../../utils/biohub-tar-parser';
import { normalizeOptionalText } from '../../utils/normalize';
import { ContributorCodesetCodeService } from '../contributor-codeset-code-service';
import { ContributorCodesetService } from '../contributor-codeset-service';
import { ContributorService } from '../contributor-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import type { TarCodesets } from './submission-ingestion-codes-service.interface';

const CONTRIBUTOR_CODE_INSERT_BATCH_SIZE = 10000;
type ExistingContributorCodeset = Awaited<
  ReturnType<ContributorCodesetService['getContributorCodesetsByContributorIdAndKeys']>
>[number];
type ExistingContributorCodesetMap = Map<string, ExistingContributorCodeset>;

/**
 * Ingest contributor codesets/codes parsed from tarball entries.
 */
export class CodesetIngestionService extends DBService {
  objectStorageService = new ObjectStorageService();
  contributorService = new ContributorService(this.connection);
  contributorCodesetService = new ContributorCodesetService(this.connection);
  contributorCodesetCodeService = new ContributorCodesetCodeService(this.connection);

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   */
  static dependencies = {
    streamCodesets
  };

  /**
   * Creates an instance of CodesetIngestionService.
   *
   * @param {IDBConnection} connection
   */
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
  async ingestCodesets(objectKey: string, submissionUploadId: string): Promise<void> {
    const contributor = await this.contributorService.getContributorBySubmissionUploadId(submissionUploadId);
    const tarStream = await this.objectStorageService.getFileStream(BucketType.MAIN, objectKey);

    await CodesetIngestionService.dependencies.streamCodesets(tarStream, async (codesets) => {
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
    const existingCodesetsByKey = await this.getExistingCodesetsByKey(contributorId, Object.keys(codesets));
    const existingCodesByCodesetId = await this.getExistingCodesByCodesetId(existingCodesetsByKey);

    for (const [codesetKey, codeset] of Object.entries(codesets)) {
      const existingCodeset = existingCodesetsByKey.get(codesetKey);
      const contributorCodeset = await this.contributorCodesetService.createCodeset(
        this.buildContributorCodesetPayload(contributorId, codesetKey, codeset, existingCodeset)
      );

      const contributorCodes = this.buildContributorCodesetCodePayloads(
        contributorCodeset.contributor_codeset_id,
        codeset.codes ?? {},
        existingCodesByCodesetId.get(contributorCodeset.contributor_codeset_id)
      );

      await this.insertContributorCodesetCodesInBatches(contributorCodes);
    }
  }

  /**
   * Build a contributor_codeset insert payload from a parsed tar codeset.
   *
   * @private
   * @param {number} contributorId
   * @param {string} codesetKey
   * @param {TarCodesets[string]} codeset
   * @returns {CreateContributorCodeset}
   */
  private buildContributorCodesetPayload(
    contributorId: number,
    codesetKey: string,
    codeset: TarCodesets[string],
    existingCodeset?: Awaited<
      ReturnType<ContributorCodesetService['getContributorCodesetsByContributorIdAndKeys']>
    >[number]
  ): CreateContributorCodeset {
    const resolvedLabel = this.resolveRequiredLabel(
      codeset.label ?? undefined,
      existingCodeset?.label,
      `codeset "${codesetKey}"`
    );

    return {
      contributor_id: contributorId,
      key: codesetKey,
      external_id: normalizeOptionalText(codeset.external_id) ?? undefined,
      label: resolvedLabel.toLowerCase(),
      description: normalizeOptionalText(codeset.description, true)
    };
  }

  /**
   * Build contributor_codeset_code insert payloads for one contributor codeset.
   *
   * @private
   * @param {number} contributorCodesetId
   * @param {NonNullable<TarCodesets[string]['codes']>} codes
   * @returns {CreateContributorCodesetCode[]}
   */
  private buildContributorCodesetCodePayloads(
    contributorCodesetId: number,
    codes: NonNullable<TarCodesets[string]['codes']>,
    existingCodesByKey: Map<string, string> = new Map()
  ): CreateContributorCodesetCode[] {
    return Object.entries(codes).map(([codeKey, code]) => ({
      label: this.resolveRequiredLabel(
        code.label ?? undefined,
        existingCodesByKey.get(codeKey),
        `code "${codeKey}" in contributor_codeset_id=${contributorCodesetId}`
      ).toLowerCase(),
      contributor_codeset_id: contributorCodesetId,
      key: codeKey,
      external_id: normalizeOptionalText(code.external_id) ?? undefined,
      description: normalizeOptionalText(code.description, true)
    }));
  }

  /**
   * Insert contributor codes in bounded batches.
   *
   * @private
   * @param {CreateContributorCodesetCode[]} codes
   * @returns {Promise<void>}
   */
  private async insertContributorCodesetCodesInBatches(codes: CreateContributorCodesetCode[]): Promise<void> {
    if (!codes.length) {
      return;
    }

    for (let index = 0; index < codes.length; index += CONTRIBUTOR_CODE_INSERT_BATCH_SIZE) {
      const currentBatch = codes.slice(index, index + CONTRIBUTOR_CODE_INSERT_BATCH_SIZE);
      await this.contributorCodesetCodeService.createContributorCodesetCodes(currentBatch);
    }
  }

  /**
   * Resolve a required label from incoming tar payload or existing database value.
   *
   * @private
   * @param {(string | undefined)} incomingLabel
   * @param {(string | undefined)} existingLabel
   * @param {string} context
   * @returns {string}
   */
  private resolveRequiredLabel(
    incomingLabel: string | undefined,
    existingLabel: string | undefined,
    context: string
  ): string {
    const normalizedIncomingLabel = normalizeOptionalText(incomingLabel);
    if (normalizedIncomingLabel) {
      return normalizedIncomingLabel;
    }

    const normalizedExistingLabel = normalizeOptionalText(existingLabel);
    if (normalizedExistingLabel) {
      return normalizedExistingLabel;
    }

    throw new IngestionValidationError(
      `Missing required label for contributor code metadata: CodesetIngestionService->resolveRequiredLabel; ${context}`
    );
  }

  /**
   * Fetch existing contributor codesets by key.
   *
   * @private
   * @param {number} contributorId
   * @param {string[]} codesetKeys
   * @returns {Promise<Map<string, Awaited<ReturnType<ContributorCodesetService['getContributorCodesetsByContributorIdAndKeys']>>[number]>>}
   */
  private async getExistingCodesetsByKey(
    contributorId: number,
    codesetKeys: string[]
  ): Promise<ExistingContributorCodesetMap> {
    const existingCodesets = await this.contributorCodesetService.getContributorCodesetsByContributorIdAndKeys(
      contributorId,
      codesetKeys
    );

    return new Map(existingCodesets.map((existingCodeset) => [existingCodeset.key, existingCodeset]));
  }

  /**
   * Fetch existing codes for existing contributor codesets and index them by codeset id then key.
   *
   * @private
   * @param {ExistingContributorCodesetMap} existingCodesetMap
   * @returns {Promise<Map<number, Map<string, string>>>}
   */
  private async getExistingCodesByCodesetId(
    existingCodesetMap: ExistingContributorCodesetMap
  ): Promise<Map<number, Map<string, string>>> {
    // Step 1: Flatten keyed codesets into contributor_codeset_id values for one bulk fetch.
    const contributorCodesetIds = [...existingCodesetMap.values()].map(
      (existingCodeset) => existingCodeset.contributor_codeset_id
    );

    if (!contributorCodesetIds.length) {
      return new Map();
    }

    // Step 2: Fetch all existing code rows for those codeset ids in one query.
    const existingCodes = await this.contributorCodesetCodeService.getContributorCodesetCodesByContributorCodesetIds(
      contributorCodesetIds
    );

    // Step 3: Re-index rows to Map<contributor_codeset_id, Map<code_key, code_label>> for O(1) lookups.
    const existingCodesByCodesetId = new Map<number, Map<string, string>>();
    for (const existingCode of existingCodes) {
      const existingCodesForCodeset =
        existingCodesByCodesetId.get(existingCode.contributor_codeset_id) ?? new Map<string, string>();

      existingCodesForCodeset.set(existingCode.key, existingCode.label);
      existingCodesByCodesetId.set(existingCode.contributor_codeset_id, existingCodesForCodeset);
    }

    return existingCodesByCodesetId;
  }
}
