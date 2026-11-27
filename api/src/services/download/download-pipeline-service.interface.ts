import { DownloadSource } from '../../models/download';
import { ActivePolicyStatementWithExpression } from '../../repositories/authorization/policy-statement-repository';
import { CsvPropertyDefinition } from '../../utils/csv-utils';

/**
 * Payload for `DownloadPipelineService.writeFeatureTypeParquet`.
 *
 * `downloadId` keys the deterministic S3 object key; `downloadVersionId` names the
 * version the file belongs to, and is the temporal axis the produced artifact is linked
 * to in `download_version_artifact`, so the export pipeline can rediscover the version's
 * Parquet files without re-running the original search. `featureIds` is the feature
 * type's part of the version's stored feature set, from
 * `listDownloadVersionFileFeatureSets`; null writes an empty file.
 */
export interface WriteFeatureTypeParquetPayload {
  downloadId: string;
  downloadVersionId: string;
  properties: CsvPropertyDefinition[];
  featureTypeName: string;
  featureIds: Buffer | null;
}

/**
 * One Parquet file a download version gets: its feature type and that type's part of the
 * version's stored feature set (a serialized bitmap), or null when the version has no feature of
 * the type.
 */
export interface DownloadVersionFileFeatureSet {
  featureTypeName: string;
  featureIds: Buffer | null;
}

/**
 * Payload for `DownloadPipelineService.storeDownloadVersionFeatureSet`.
 */
export interface StoreDownloadVersionFeatureSetPayload {
  downloadVersionId: string;
  source: DownloadSource;
  statements: EffectiveDownloadStatement[];
}

/**
 * A policy statement after resolving wildcard and overlapping ALLOW rules for a
 * concrete feature type.
 */
export type EffectiveDownloadStatement = ActivePolicyStatementWithExpression & {
  /** Multiple filtered ALLOW expressions for the same feature type are UNIONed. */
  expression_ids?: string[];
};
