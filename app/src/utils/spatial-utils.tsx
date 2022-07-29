import { BoundaryFeature, BoundaryFeaturePopup } from 'components/map/BoundaryFeaturePopup';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import { OccurrenceFeature, OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { IGetSpatialDataResponse } from 'interfaces/useSearchApi.interface';
import { LatLngTuple } from 'leaflet';
import React from 'react';

export const parseSpatialDataByType = (spatialData: IGetSpatialDataResponse[]) => {
  const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [] };

  const occurrenceStaticLayer: IStaticLayer = { layerName: LAYER_NAME.OCCURRENCES, features: [] };
  const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [] };

  for (const item of spatialData) {
    for (const feature of item.spatial_data.features) {
      if (isOccurrenceFeature(feature)) {
        if (feature.geometry.type === 'GeometryCollection') {
          // Not expecting or supporting geometry collections
          continue;
        }

        occurrencesMarkerLayer.markers.push({
          position: feature.geometry.coordinates as LatLngTuple,
          key: feature.id || feature.properties.id,
          popup: <OccurrenceFeaturePopup properties={feature.properties} />
        });
      }

      if (isBoundaryFeature(feature)) {
        if (feature.geometry.type === 'GeometryCollection') {
          continue;
        }

        boundaryStaticLayer.features.push({
          geoJSON: feature,
          key: feature.id || feature.properties.id,
          popup: <BoundaryFeaturePopup properties={feature.properties} />
        });
      }
    }
  }

  return { markerLayers: [occurrencesMarkerLayer], staticLayers: [occurrenceStaticLayer, boundaryStaticLayer] };
};

export const isOccurrenceFeature = (feature: Feature): feature is OccurrenceFeature => {
  return feature.geometry.type === 'Point' && feature.properties?.['type'] === SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export const isBoundaryFeature = (feature: Feature): feature is BoundaryFeature => {
  return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY;
};
