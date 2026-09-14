import { FeatureReferencePropertyValue } from 'interfaces/property-value.interface';
import { type SubmissionFeaturePathResolver } from 'utils/routes.interface';
import { parseFeatureUrn } from 'utils/urn-utils';
import { PropertyValueLink } from './PropertyValueLink';

interface FeaturePropertyValueLinkProps {
  value: FeatureReferencePropertyValue;
  getSubmissionFeaturePath: SubmissionFeaturePathResolver;
}

/**
 * Renders a feature reference value as its `label`, linking to the referenced feature's detail page.
 *
 * The destination is resolved from the URN (the referenced feature's own submission and id); a URN that
 * does not identify a single feature renders as plain text.
 *
 * @param {FeaturePropertyValueLinkProps} props
 * @returns {JSX.Element}
 */
export const FeaturePropertyValueLink = ({ value, getSubmissionFeaturePath }: FeaturePropertyValueLinkProps) => {
  const parsed = parseFeatureUrn(value.urn);

  if (!parsed) {
    return <>{value.label}</>;
  }

  return (
    <PropertyValueLink
      to={getSubmissionFeaturePath(parsed.submissionId, parsed.submissionFeatureId)}
      label={value.label}
      title={value.urn}
    />
  );
};
