import { SPATIAL_COMPONENT_TYPE } from 'features/map/MapPage';
import { Feature } from 'geojson';
import React from 'react';

export type OccurrenceClusterFeature = Feature & { properties: OccurrenceClusterFeatureProperties };

export type OccurrenceClusterFeatureProperties = {
  cluster_type: SPATIAL_COMPONENT_TYPE.OCCURRENCE;
  cluster_count: number;
  cluster_taxon: string[];
};

export const OccurrenceClusterFeaturePopup: React.FC<{ properties: OccurrenceClusterFeatureProperties }> = (props) => {
  const { properties } = props;

  return (
    <div>
      <div>{JSON.stringify(properties)}</div>
    </div>
  );
};
