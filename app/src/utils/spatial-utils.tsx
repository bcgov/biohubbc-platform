import { BoundaryFeature, BoundaryFeaturePopup } from 'components/map/BoundaryFeaturePopup';
import { IMarker, IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import { OccurrenceFeature, OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { LAYER_NAME, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature, FeatureCollection } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { LatLngTuple } from 'leaflet';
import React from 'react';

export const parseFeatureCollectionsByType = (featureCollections: FeatureCollection[]) => {
  const api = useApi();

  const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [] };

  const occurrenceStaticLayer: IStaticLayer = { layerName: LAYER_NAME.OCCURRENCES, features: [] };
  const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [] };

  const spatialMetaDataLoader = useDataLoader((submissionId: number) => {
    return api.search.getSpatialMetadata(submissionId)
  })

  const makePopupProps = (submissionId: number): IMarker['PopupProps'] => ({
    onOpen: () => {
      spatialMetaDataLoader.refresh(submissionId)
    }
  })

  for (const featureCollection of featureCollections) {
    for (const feature of featureCollection.features) {
      if (isOccurrenceFeature(feature)) {
        if (feature.geometry.type === 'GeometryCollection') {
          // Not expecting or supporting geometry collections
          continue;
        }

        const metadata = null

        occurrencesMarkerLayer.markers.push({
          position: feature.geometry.coordinates as LatLngTuple,
          key: feature.id,
          popup: <OccurrenceFeaturePopup
            metadata={metadata}
          />,
          PopupProps: {...makePopupProps(submissionId)}
        });
      }

      if (isBoundaryFeature(feature)) {
        if (feature.geometry.type === 'GeometryCollection') {
          continue;
        }

        const metadata = null

        boundaryStaticLayer.features.push({
          geoJSON: feature,
          key: feature.id,
          popup: <BoundaryFeaturePopup
            metadata={metadata}
          />,
          PopupProps: {...makePopupProps(submissionId)}
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
