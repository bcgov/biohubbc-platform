/**
 * Normalize an artifact reference so feature payload values and archive entry
 * paths resolve to the same deterministic lookup key.
 */
export function normalizeArtifactReference(value: string): string {
  let normalized = value.trim();

  if (normalized.startsWith('files/')) {
    normalized = normalized.slice('files/'.length);
  }

  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  return normalized;
}
