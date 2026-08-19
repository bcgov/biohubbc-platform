import { Fragment } from 'react';
import { JsonValue } from 'types/json';
import { getPropertyValueKey } from 'utils/property-value-utils';
import { PropertyValueDisplay } from './PropertyValueDisplay';

export interface PropertyValueListProps {
  /** Values of a multi-value property. */
  values: JsonValue[];
  /** Submission the owning feature belongs to (link context for reference values). */
  submissionId?: string | number;
  /** Submission route base, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a multi-value property inline, comma-separated, each entry via {@link PropertyValueDisplay}.
 *
 * @param {PropertyValueListProps} props
 * @returns {JSX.Element}
 */
export const PropertyValueList = ({ values, submissionId, featureRouteBasePath }: PropertyValueListProps) => {
  const items = values.filter((item) => item !== null && item !== undefined);

  return (
    <>
      {items.map((item, index) => (
        <Fragment key={`${getPropertyValueKey(item)}:${index}`}>
          {index > 0 && ', '}
          <PropertyValueDisplay value={item} submissionId={submissionId} featureRouteBasePath={featureRouteBasePath} />
        </Fragment>
      ))}
    </>
  );
};
