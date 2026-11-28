import { normalizeCase } from '../utils/normalize';
import { FeatureUrn } from './urn-utils.interface';

/**
 * Get the submission, feature type name, and submission feature ID from an urn
 *
 * Format: "urn:<submissionId>:<featureTypeName>:<submissionFeatureId>"
 *
 * @param {string} urn - The urn of the submission feature record to parse
 * @return {FeatureUrn}  - The keys in the URN
 */
export const parseFeatureUrn = (urn: string): FeatureUrn => {
  const parts = urn.split(':');

  if (parts.length !== 4 || parts[0] !== 'urn') {
    throw new Error(`Invalid URN format: ${urn}`);
  }

  const [, submissionId, featureTypeName, submissionFeatureId] = parts;

  return {
    submissionId: submissionId,
    featureTypeName,
    submissionFeatureId: submissionFeatureId
  };
};

/**
 * Normalize the feature type segment of a submission feature URN, so it matches the stored feature type name.
 *
 * Feature type names are stored trimmed and lowercase, so `urn:*:Telemetry:*` and `urn:*:telemetry:*` name the same
 * scope. The submission and feature segments, and a `*` feature type, are kept as given.
 *
 * Format: "urn:<submissionId>:<featureTypeName>:<submissionFeatureId>"
 *
 * @param {string} urn - The submission feature URN to normalize
 * @return {string} - The URN with its feature type segment trimmed and lowercased
 */
export const normalizeFeatureUrn = (urn: string): string => {
  const { submissionId, featureTypeName, submissionFeatureId } = parseFeatureUrn(urn);

  return `urn:${submissionId}:${normalizeCase(featureTypeName)}:${submissionFeatureId}`;
};
