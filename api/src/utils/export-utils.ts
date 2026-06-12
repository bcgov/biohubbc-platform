/**
 * Pure helpers for the CSV export pipeline.
 *
 * Small, bounded business rules that live outside the pipeline service so they
 * can be unit-tested in isolation. The service orchestrates (gather → decide
 * → act); these functions are the "decide" step.
 */

/**
 * Parse a feature-type name out of a download version's Parquet artifact key.
 *
 * Parquet files land at the version-scoped shape
 * `downloads/{downloadId}/versions/{downloadVersionId}/{featureTypeName}/data.parquet`.
 * The key is matched against BOTH `downloadId` and `downloadVersionId`, so a key
 * belonging to a different version of the same download is rejected — recovering
 * a feature type only from the version it actually belongs to. Any other shape —
 * including the per-part export zips under `.../exports/...` — returns null so the
 * caller naturally filters those artifacts out.
 *
 * @returns the feature type name, or null if the key is not a Parquet source for this version.
 */
export function parseFeatureTypeFromParquetKey(
  objectKey: string,
  downloadId: string,
  downloadVersionId: string
): string | null {
  const parts = objectKey.split('/');
  if (parts.length !== 6) {
    return null;
  }
  if (
    parts[0] !== 'downloads' ||
    parts[1] !== downloadId ||
    parts[2] !== 'versions' ||
    parts[3] !== downloadVersionId ||
    parts[5] !== 'data.parquet'
  ) {
    return null;
  }
  return parts[4];
}

/**
 * Build the deterministic S3 key for a part-zip.
 *
 * Shape: `downloads/{downloadId}/versions/{downloadVersionId}/exports/{groupId}/biohub-{groupId}-part-{N}.zip`.
 *
 * The physical zip is shared across every user export that resolved to the same
 * export-artifact group, so the key is scoped by the GROUP — and the version it
 * belongs to — not by any individual user's export. That is why the leaf
 * filename embeds `groupId` (not the version, and not a per-user export id):
 * two users whose exports collapse to one group read the exact same object.
 *
 * Named so the rule lives in exactly one place — a reorder or index drift is a
 * one-file fix and unit-testable. Pairs with the `artifact UNIQUE (bucket,
 * object_key)` constraint for retry idempotency.
 */
export function buildPartZipKey(
  downloadId: string,
  downloadVersionId: string,
  groupId: string,
  partIndex: number
): string {
  return `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/biohub-${groupId}-part-${partIndex}.zip`;
}

/**
 * Pull the ids back out of a part-zip key built by `buildPartZipKey`.
 *
 * Inverse of `buildPartZipKey`, kept beside it so the key shape lives in one
 * place — a segment reorder breaks both at once. The user-facing download name
 * (`{downloadId}_{downloadVersionId}_{timestamp}_part{N}.zip`) is derived from
 * the same key that locates the object, so the name always describes the file.
 *
 * @throws if `objectKey` is not a `downloads/.../versions/.../exports/...` part key.
 */
export function parseExportPartKey(objectKey: string): {
  downloadId: string;
  downloadVersionId: string;
  groupId: string;
} {
  const parts = objectKey.split('/');
  if (parts.length !== 7 || parts[0] !== 'downloads' || parts[2] !== 'versions' || parts[4] !== 'exports') {
    throw new Error(`parseExportPartKey: unexpected export part key shape: ${objectKey}`);
  }
  return { downloadId: parts[1], downloadVersionId: parts[3], groupId: parts[5] };
}

/**
 * Build the deterministic S3 key for a feature type's raw Parquet artifact.
 *
 * Shape: `downloads/{downloadId}/versions/{downloadVersionId}/{featureTypeName}/data.parquet`.
 *
 * Each version's raw Parquet is immutable and addressable. Scoping the key by
 * `downloadVersionId` means re-running a download writes a new path rather than
 * overwriting an older version's files, so prior versions stay readable for as
 * long as they are retained. Pairs with `parseFeatureTypeFromParquetKey`, which
 * recovers the feature type from this exact shape.
 */
export function buildParquetKey(downloadId: string, downloadVersionId: string, featureTypeName: string): string {
  return `downloads/${downloadId}/versions/${downloadVersionId}/${featureTypeName}/data.parquet`;
}

/**
 * Decide whether the current byte count should roll over to a new part.
 *
 * Single crossing check — the part is "full" once `currentByteCount` has
 * reached `maxPartSizeBytes`. Extracted so the boundary decision is testable
 * without spinning up the whole streaming pipeline.
 */
export function shouldRollPart(currentByteCount: bigint, maxPartSizeBytes: bigint): boolean {
  return currentByteCount >= maxPartSizeBytes;
}
