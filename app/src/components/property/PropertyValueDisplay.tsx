import Link from '@mui/material/Link';
import { StructuredPropertyValue } from 'interfaces/useFeaturesApi.interface';
import { Fragment, MouseEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { JsonValue } from 'types/json';
import { isCodeValue, isFeatureValue, isStructuredPropertyValue, isTaxonValue } from 'utils/property-value-utils';
import { formatSubmissionPropertyValue } from 'utils/search-result-utils';
import { safeJSONStringify } from 'utils/Utils';
import { parseFeatureUrn } from 'utils/urn-utils';

/** Taxonomic ranks conventionally rendered in scientific-name style (italic). */
const ITALIC_TAXON_RANKS = new Set(['species', 'subspecies', 'variety', 'form']);

/** Prevents a value link/label click from also triggering an enclosing row click. */
const stopPropagation = (event: MouseEvent) => event.stopPropagation();

interface ReferenceLabelProps {
  label: string;
  title?: string;
  italic?: boolean;
  dataProps?: Record<string, string | number>;
}

/**
 * Link-styled but inert label for reference values that have no destination page yet (taxon, code,
 * unresolvable feature URNs). The structured identifiers are surfaced via `title` and `data-*`
 * attributes so future routing/hover previews can use them.
 *
 * @param {ReferenceLabelProps} props
 * @returns {JSX.Element}
 */
const ReferenceLabel = ({ label, title, italic, dataProps }: ReferenceLabelProps) => (
  <Link
    component="span"
    underline="hover"
    color="primary"
    title={title}
    onClick={stopPropagation}
    sx={{ cursor: 'default', fontStyle: italic ? 'italic' : undefined }}
    {...dataProps}>
    {label}
  </Link>
);

interface StructuredValueDisplayProps {
  value: StructuredPropertyValue;
  /** Route base for feature-reference links, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a reference-typed structured value (taxon, code, or feature) as a link/link-like element.
 *
 * Feature references link to the referenced feature detail page when the URN resolves; taxon and code
 * render as link-styled but inert labels that retain their structured identifiers.
 *
 * @param {StructuredValueDisplayProps} props
 * @returns {JSX.Element}
 */
const StructuredValueDisplay = ({ value, featureRouteBasePath }: StructuredValueDisplayProps) => {
  // Captured while `value` is a known reference type, for the defensive fallback below once the
  // specific-type guards have exhausted the union.
  const { label } = value;

  if (isFeatureValue(value)) {
    const parsed = parseFeatureUrn(value.urn);

    if (!parsed) {
      return <ReferenceLabel label={value.label} title={value.urn} dataProps={{ 'data-urn': value.urn }} />;
    }

    return (
      <Link
        component={RouterLink}
        to={`${featureRouteBasePath}/${parsed.submissionId}/feature/${parsed.submissionFeatureId}`}
        underline="hover"
        title={value.urn}
        onClick={stopPropagation}
        data-urn={value.urn}>
        {value.label}
      </Link>
    );
  }

  if (isTaxonValue(value)) {
    const italic = value.rank ? ITALIC_TAXON_RANKS.has(value.rank.toLowerCase()) : false;
    const title = [value.tsn ? `TSN ${value.tsn}` : null, value.rank].filter(Boolean).join(' · ');
    const dataProps: Record<string, string | number> = { 'data-taxon-id': value.taxon_id };

    if (value.tsn) {
      dataProps['data-tsn'] = value.tsn;
    }

    return <ReferenceLabel label={value.label} title={title || undefined} italic={italic} dataProps={dataProps} />;
  }

  if (isCodeValue(value)) {
    const title = [value.codeset_label, value.code_label].filter(Boolean).join(' / ');

    return (
      <ReferenceLabel
        label={value.label}
        title={title || undefined}
        dataProps={{ 'data-codeset-key': value.codeset_key, 'data-code-key': value.code_key }}
      />
    );
  }

  // Structured object with a label but an unrecognized discriminator: show the label.
  return <ReferenceLabel label={label} />;
};

/**
 * Builds a stable, content-derived React key for a property-value list entry (avoids array-index
 * keys). Reference values key on their identifiers; scalars and non-reference objects key on their
 * display string.
 *
 * @param {unknown} item - A single property value.
 * @returns {string} A stable key for the item.
 */
const getPropertyValueKey = (item: unknown): string => {
  if (isStructuredPropertyValue(item)) {
    const { label } = item;

    if (isFeatureValue(item)) {
      return `feature:${item.urn}`;
    }
    if (isTaxonValue(item)) {
      return `taxon:${item.taxon_id}`;
    }
    if (isCodeValue(item)) {
      return `code:${item.codeset_key}:${item.code_key}`;
    }
    return `label:${label}`;
  }

  return `scalar:${formatSubmissionPropertyValue(item as JsonValue)}`;
};

interface PropertyValueListProps {
  values: unknown[];
  /** Route base for feature-reference links, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a multi-value property as its entries inline, separated by commas.
 *
 * @param {PropertyValueListProps} props
 * @returns {JSX.Element}
 */
const PropertyValueList = ({ values, featureRouteBasePath }: PropertyValueListProps) => {
  const items = values.filter((item) => item !== null && item !== undefined);

  return (
    <>
      {items.map((item, index) => (
        <Fragment key={getPropertyValueKey(item)}>
          {index > 0 && ', '}
          <PropertyValueDisplay value={item} featureRouteBasePath={featureRouteBasePath} />
        </Fragment>
      ))}
    </>
  );
};

interface PropertyValueDisplayProps {
  /** Raw property value: a scalar, a structured reference object, GeoJSON, or an array of these. */
  value: unknown;
  /** Route base for feature-reference links, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a submitted property value for the search result table and feature detail Properties block.
 *
 * Reference-typed values (taxon, code, feature) render their `label` as a link/link-like element via
 * {@link StructuredValueDisplay}; multi-value arrays render inline via {@link PropertyValueList};
 * scalar values and GeoJSON render as text.
 *
 * @param {PropertyValueDisplayProps} props
 * @returns {JSX.Element | null}
 */
export const PropertyValueDisplay = ({ value, featureRouteBasePath }: PropertyValueDisplayProps) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return <PropertyValueList values={value} featureRouteBasePath={featureRouteBasePath} />;
  }

  if (isStructuredPropertyValue(value)) {
    return <StructuredValueDisplay value={value} featureRouteBasePath={featureRouteBasePath} />;
  }

  // Non-reference objects (GeoJSON, nested values) stringify rather than render "[object Object]".
  if (typeof value === 'object') {
    return <>{safeJSONStringify(value) ?? ''}</>;
  }

  if (typeof value === 'string') {
    return <>{value}</>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <>{value.toString()}</>;
  }

  return null;
};
