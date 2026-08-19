/** Components of a submission feature URN: `urn:<submissionId>:<featureTypeName>:<submissionFeatureId>`. */
export interface ParsedFeatureUrn {
  submissionId: number;
  featureTypeName: string;
  submissionFeatureId: number;
}

/**
 * Parses a submission feature URN into its components.
 *
 * Feature URNs are `urn:<submissionId>:<featureTypeName>:<submissionFeatureId>` with concrete positive
 * integer ids. Wildcard URNs (e.g. `urn:*:telemetry:*`, as used by access policies) and malformed values
 * do not identify a single feature and yield `null`.
 *
 * @param {string} urn - The feature URN to parse.
 * @returns {ParsedFeatureUrn | null} The parsed components, or `null` when the URN does not identify one feature.
 */
export const parseFeatureUrn = (urn: string): ParsedFeatureUrn | null => {
  const parts = urn.split(':');

  if (parts.length !== 4 || parts[0] !== 'urn') {
    return null;
  }

  const [, submissionIdPart, featureTypeName, submissionFeatureIdPart] = parts;

  if (!featureTypeName || !/^\d+$/.test(submissionIdPart) || !/^\d+$/.test(submissionFeatureIdPart)) {
    return null;
  }

  const submissionId = Number(submissionIdPart);
  const submissionFeatureId = Number(submissionFeatureIdPart);

  if (submissionId <= 0 || submissionFeatureId <= 0) {
    return null;
  }

  return { submissionId, featureTypeName, submissionFeatureId };
};
