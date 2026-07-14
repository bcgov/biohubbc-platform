/** Parsed components of a submission feature URN (`urn:<submissionId>:<featureTypeName>:<submissionFeatureId>`). */
export interface ParsedFeatureUrn {
  submissionId: number;
  featureTypeName: string;
  submissionFeatureId: number;
}

/**
 * Parses a submission feature URN into its components.
 *
 * The URN format is `urn:<submissionId>:<featureTypeName>:<submissionFeatureId>` (see the
 * `tr_submission_feature_urn` database trigger). Returns `null` for malformed URNs or wildcard
 * URNs (e.g. `urn:*:telemetry:*`) that cannot be resolved to a concrete feature link.
 *
 * @param {string} urn - The feature URN to parse.
 * @returns {ParsedFeatureUrn | null} The parsed components, or `null` when the URN is not linkable.
 */
export const parseFeatureUrn = (urn: string): ParsedFeatureUrn | null => {
  const parts = urn.split(':');

  if (parts.length !== 4 || parts[0] !== 'urn') {
    return null;
  }

  const submissionId = Number(parts[1]);
  const featureTypeName = parts[2];
  const submissionFeatureId = Number(parts[3]);

  if (
    !featureTypeName ||
    !Number.isInteger(submissionId) ||
    submissionId <= 0 ||
    !Number.isInteger(submissionFeatureId) ||
    submissionFeatureId <= 0
  ) {
    return null;
  }

  return { submissionId, featureTypeName, submissionFeatureId };
};
