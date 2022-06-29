import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SPATIAL_COMPONENT_TYPE } from 'features/map/MapPage';
import React from 'react';
import { getFormattedDate } from 'utils/Utils';

export type BoundaryFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.BOUNDARY;
  id: number;
  eventDate: string;
};

export const BoundaryFeaturePopup: React.FC<{ properties: BoundaryFeatureProperties }> = (props) => {
  const { properties } = props;

  return (
    <div>
      <div>{JSON.stringify(properties)}</div>
      <div>{getFormattedDate(DATE_FORMAT.ShortMediumDateFormat2, properties.eventDate || '')}</div>
    </div>
  );
};
