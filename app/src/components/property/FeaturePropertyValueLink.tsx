import { FeatureReferencePropertyValue } from 'interfaces/property-value.interface';
import { useLocation } from 'react-router-dom';
import { buildSubmissionFeaturePath } from 'utils/routes';
import { parseFeatureUrn } from 'utils/urn-utils';
import { PropertyValueLink } from './PropertyValueLink';

export interface FeaturePropertyValueLinkProps {
  /** Structured feature reference value from the indexed-property read model. */
  value: FeatureReferencePropertyValue;
  /** Submission route base, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
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
export const FeaturePropertyValueLink = ({ value, featureRouteBasePath }: FeaturePropertyValueLinkProps) => {
  const location = useLocation();
  const parsed = parseFeatureUrn(value.urn);

  if (!parsed) {
    return <>{value.label}</>;
  }

  return (
    <PropertyValueLink
      to={buildSubmissionFeaturePath(
        featureRouteBasePath,
        parsed.submissionId,
        parsed.submissionFeatureId,
        location.search
      )}
      label={value.label}
      title={value.urn}
      dataAttributes={{ 'data-urn': value.urn }}
    />
  );
};
