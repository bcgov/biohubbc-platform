import { SPATIAL_COMPONENT_TYPE } from 'features/map/MapPage';
import { Feature } from 'geojson';
import React from 'react';

export type OccurrenceFeature = Feature & { properties: OccurrenceFeatureProperties };

export type OccurrenceFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.OCCURRENCE;
  taxon: string;
};

export const OccurrenceFeaturePopup: React.FC<{ properties: OccurrenceFeatureProperties }> = (props) => {
  const { properties } = props;

  return (
    <div>
      <div>{JSON.stringify(properties)}</div>
    </div>
  );
};
