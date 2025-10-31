import { SubmissionFeature } from '../repositories/submission-repository';

/**
 * Build a URN for a submission feature.
 *
 * Format: "urn:<submissionId>:<featureTypeName>:<submissionFeatureId>"
 *
 * @param {SubmissionFeature} feature - The submission feature record
 * @return {string} - The generated URN
 */
export const buildFeatureUrnFromFeatureRecord = (feature: SubmissionFeature): string => {
  return `urn:${feature.submission_id}:${feature.feature_type_name}:${feature.submission_feature_id}`;
};

/**
 * Get the submission, feature type name, and submission feature ID from an urn
 *
 * Format: "urn:<submissionId>:<featureTypeName>:<submissionFeatureId>"
 *
 * @param {string} urn - The submission feature record
 * @return { submissionId: number; featureTypeName: string; submissionFeatureId: number }  - The generated URN
 */
export const parseFeatureUrn = (
  urn: string
): { submissionId: number; featureTypeName: string; submissionFeatureId: number } => {
  const parts = urn.split(':');

  if (parts.length !== 4 || parts[0] !== 'urn') {
    throw new Error(`Invalid URN format: ${urn}`);
  }

  const [, submissionIdStr, featureTypeName, submissionFeatureIdStr] = parts;

  return {
    submissionId: Number(submissionIdStr),
    featureTypeName,
    submissionFeatureId: Number(submissionFeatureIdStr)
  };
};
