import { Fragment } from 'react';
import { JsonValue } from 'types/json';
import { getPropertyValueKey } from 'utils/property-value-utils';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';
import { PropertyValueDisplay } from './PropertyValueDisplay';

interface PropertyValueListProps {
  values: JsonValue[];
  submissionId: number;
  pathResolvers: SubmissionPropertyValuePathResolvers;
}

/**
 * Renders a multi-value property inline, comma-separated, each entry via {@link PropertyValueDisplay}.
 *
 * @param {PropertyValueListProps} props
 * @returns {JSX.Element}
 */
export const PropertyValueList = ({ values, submissionId, pathResolvers }: PropertyValueListProps) => {
  const items = values.filter((item) => item !== null && item !== undefined);

  return (
    <>
      {items.map((item, index) => (
        <Fragment key={`${getPropertyValueKey(item)}:${index}`}>
          {index > 0 && ', '}
          <PropertyValueDisplay value={item} submissionId={submissionId} pathResolvers={pathResolvers} />
        </Fragment>
      ))}
    </>
  );
};
