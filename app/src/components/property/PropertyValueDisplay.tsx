import { JsonValue } from 'types/json';
import { isCodePropertyValue, isFeatureReferencePropertyValue, isTaxonPropertyValue } from 'utils/property-value-utils';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';
import { safeJSONStringify } from 'utils/Utils';
import { CodePropertyValueLink } from './CodePropertyValueLink';
import { FeaturePropertyValueLink } from './FeaturePropertyValueLink';
import { PropertyValueList } from './PropertyValueList';
import { TaxonPropertyValueLink } from './TaxonPropertyValueLink';

interface PropertyValueDisplayProps {
  value: JsonValue | undefined;
  submissionId: number;
  pathResolvers: SubmissionPropertyValuePathResolvers;
}

/**
 * Renders a submitted property value for the search result table and the feature detail Properties block.
 *
 * Reference values (taxon, code, feature) render their `label` as a link; multi-value arrays render inline via
 * {@link PropertyValueList}; other objects (e.g. GeoJSON) render as JSON text; scalars render as text.
 *
 * @param {PropertyValueDisplayProps} props
 * @returns {JSX.Element | null}
 */
export const PropertyValueDisplay = ({ value, submissionId, pathResolvers }: PropertyValueDisplayProps) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return <PropertyValueList values={value} submissionId={submissionId} pathResolvers={pathResolvers} />;
  }

  if (isTaxonPropertyValue(value)) {
    return (
      <TaxonPropertyValueLink
        value={value}
        submissionId={submissionId}
        getSubmissionTaxonPath={pathResolvers.getSubmissionTaxonPath}
      />
    );
  }

  if (isCodePropertyValue(value)) {
    return (
      <CodePropertyValueLink
        value={value}
        submissionId={submissionId}
        getSubmissionCodePath={pathResolvers.getSubmissionCodePath}
      />
    );
  }

  if (isFeatureReferencePropertyValue(value)) {
    return <FeaturePropertyValueLink value={value} getSubmissionFeaturePath={pathResolvers.getSubmissionFeaturePath} />;
  }

  if (typeof value === 'object') {
    return <>{safeJSONStringify(value)}</>;
  }

  return <>{String(value)}</>;
};
