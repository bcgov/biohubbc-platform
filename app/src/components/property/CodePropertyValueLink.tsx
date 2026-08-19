import { CodePropertyValue } from 'interfaces/property-value.interface';
import { useLocation } from 'react-router-dom';
import { buildSubmissionCodePath } from 'utils/routes';
import { PropertyValueLink } from './PropertyValueLink';

export interface CodePropertyValueLinkProps {
  /** Structured code value from the indexed-property read model. */
  value: CodePropertyValue;
  /** Submission the referencing feature belongs to. */
  submissionId: string | number;
  /** Submission route base, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a code value as its `label`, linking to the code page under the referencing submission.
 *
 * The codeset and code labels are exposed as hover text, and their keys as `data-*` attributes.
 *
 * @param {CodePropertyValueLinkProps} props
 * @returns {JSX.Element}
 */
export const CodePropertyValueLink = ({ value, submissionId, featureRouteBasePath }: CodePropertyValueLinkProps) => {
  const location = useLocation();

  return (
    <PropertyValueLink
      to={buildSubmissionCodePath(
        featureRouteBasePath,
        submissionId,
        value.codeset_key,
        value.code_key,
        location.search
      )}
      label={value.label}
      title={`${value.codeset_label} / ${value.code_label}`}
      dataAttributes={{ 'data-codeset-key': value.codeset_key, 'data-code-key': value.code_key }}
    />
  );
};
