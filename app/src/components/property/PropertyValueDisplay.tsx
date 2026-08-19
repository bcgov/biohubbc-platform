import { JsonValue } from 'types/json';
import { isCodePropertyValue, isTaxonPropertyValue } from 'utils/property-value-utils';
import { safeJSONStringify } from 'utils/Utils';
import { CodePropertyValueLink } from './CodePropertyValueLink';
import { PropertyValueList } from './PropertyValueList';
import { TaxonPropertyValueLink } from './TaxonPropertyValueLink';

export interface PropertyValueDisplayProps {
  /** Raw property value: a scalar, a structured reference value, GeoJSON, or an array of these. */
  value: JsonValue | undefined;
  /** Submission the owning feature belongs to (link context for reference values). */
  submissionId: number;
  /** Submission route base, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a submitted property value for the search result table and the feature detail Properties block.
 *
 * Reference values (taxon, code) render their `label` as a link; multi-value arrays render inline via
 * {@link PropertyValueList}; other objects (e.g. GeoJSON) render as JSON text; scalars render as text.
 *
 * @param {PropertyValueDisplayProps} props
 * @returns {JSX.Element | null}
 */
export const PropertyValueDisplay = ({ value, submissionId, featureRouteBasePath }: PropertyValueDisplayProps) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return <PropertyValueList values={value} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />;
  }

  if (isTaxonPropertyValue(value)) {
    return (
      <TaxonPropertyValueLink value={value} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />
    );
  }

  if (isCodePropertyValue(value)) {
    return submissionId === undefined ? (
      <>{value.label}</>
    ) : (
      <CodePropertyValueLink value={value} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />
    );
  }

  if (typeof value === 'object') {
    return <>{safeJSONStringify(value)}</>;
  }

  return <>{String(value)}</>;
};
