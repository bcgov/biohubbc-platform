import { CodePropertyValue } from 'interfaces/property-value.interface';
import { type SubmissionCodePathResolver } from 'utils/routes.interface';
import { PropertyValueLink } from './PropertyValueLink';

interface CodePropertyValueLinkProps {
  value: CodePropertyValue;
  submissionId: number;
  getSubmissionCodePath: SubmissionCodePathResolver;
}

/**
 * Renders a code value as its `label`, linking to the code page under the referencing submission.
 *
 * The codeset and code labels are exposed as hover text, and their keys as `data-*` attributes.
 *
 * @param {CodePropertyValueLinkProps} props
 * @returns {JSX.Element}
 */
export const CodePropertyValueLink = ({ value, submissionId, getSubmissionCodePath }: CodePropertyValueLinkProps) => {
  return (
    <PropertyValueLink
      to={getSubmissionCodePath(submissionId, value.codeset_key, value.code_key)}
      label={value.label}
      title={`${value.codeset_label} / ${value.code_label}`}
    />
  );
};
