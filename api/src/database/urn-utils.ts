/**
 * Get the submission, feature type name, and submission feature ID from an urn
 *
 * Format: "urn:<submissionId>:<featureTypeName>:<submissionFeatureId>"
 *
 * @param {string} urn - The urn of the submission feature record to parse
 * @return { submissionId: number; featureTypeName: string; submissionFeatureId: number }  - The keys in the URN
 */
export const parseFeatureUrn = (
  urn: string
): { submissionId: number; featureTypeName: string; submissionFeatureId: number } => {
  const parts = urn.split(':');

  if (parts.length !== 4 || parts[0] !== 'urn') {
    throw new Error(`Invalid URN format: ${urn}`);
  }

  const [, submissionId, featureTypeName, submissionFeatureId] = parts;

  return {
    submissionId: Number(submissionId),
    featureTypeName,
    submissionFeatureId: Number(submissionFeatureId)
  };
};
