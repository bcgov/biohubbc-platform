/**
 * Pure helpers for the CSV export pipeline.
 *
 * Small, bounded business rules that live outside the pipeline service so they
 * can be unit-tested in isolation. The service orchestrates (gather → decide
 * → act); these functions are the "decide" step.
 */

/**
 * Parse a feature-type name out of a download's Parquet artifact key.
 *
 * Parquet files land at `downloads/{downloadId}/{featureTypeName}/data.parquet`
 * (see `DownloadPipelineService.writeFeatureTypeParquet`). Any other key shape —
 * including the per-part export zips this ticket writes — returns null so the
 * caller naturally filters them out.
 *
 * @returns the feature type name, or null if the key is not a Parquet source.
 */
export function parseFeatureTypeFromParquetKey(objectKey: string, downloadId: string): string | null {
  const parts = objectKey.split('/');
  if (parts.length !== 4) {
    return null;
  }
  if (parts[0] !== 'downloads' || parts[1] !== downloadId || parts[3] !== 'data.parquet') {
    return null;
  }
  return parts[2];
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
 * Decide whether the current byte count should roll over to a new part.
 *
 * Single crossing check — the part is "full" once `currentByteCount` has
 * reached `maxPartSizeBytes`. Extracted so the boundary decision is testable
 * without spinning up the whole streaming pipeline.
 */
export function shouldRollPart(currentByteCount: bigint, maxPartSizeBytes: bigint): boolean {
  return currentByteCount >= maxPartSizeBytes;
}
