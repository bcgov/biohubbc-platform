import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { BoundaryFeature, BoundaryFeaturePopup } from 'components/map/BoundaryFeaturePopup';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { OccurrenceFeature, OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { LatLngBounds, LatLngTuple } from 'leaflet';
import React, { useEffect, useState } from 'react';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';

export const ALL_OF_BC_BOUNDARY: Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-146.95401365536304, 44.62175409623327],
        [-146.95401365536304, 63.528970541102794],
        [-105.07413084286304, 63.528970541102794],
        [-105.07413084286304, 44.62175409623327],
        [-146.95401365536304, 44.62175409623327]
      ]
    ]
  }
};

export enum SPATIAL_COMPONENT_TYPE {
  OCCURRENCE = 'Occurrence',
  BOUNDARY = 'Boundary'
}

export enum LAYER_NAME {
  OCCURRENCES = 'Occurrences',
  BOUNDARIES = 'Boundaries'
}

const DatasetPage: React.FC = () => {
  const api = useApi();

  const mapDataLoader = useDataLoader((boundary: Feature, type: string[]) =>
    api.search.getSpatialData({ boundary: boundary, type: type })
  );

  useDataLoaderError(mapDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Map Data',
      dialogText:
        'An error has occurred while attempting to load the map data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  const [markerLayers, setMarkerLayers] = useState<IMarkerLayer[]>([]);
  const [staticLayers, setStaticLayers] = useState<IStaticLayer[]>([]);

  useEffect(() => {
    if (!mapDataLoader.data?.length) {
      return;
    }

    const occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [] };

    const occurrenceStaticLayer: IStaticLayer = { layerName: LAYER_NAME.OCCURRENCES, features: [] };
    const boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [] };

    for (const featureCollection of mapDataLoader.data) {
      for (const feature of featureCollection.features) {
        if (isOccurrenceFeature(feature)) {
          if (feature.geometry.type === 'GeometryCollection') {
            // Not expecting or supporting geometry collections
            continue;
          }

          occurrencesMarkerLayer.markers.push({
            position: feature.geometry.coordinates as LatLngTuple,
            key: feature.id,
            popup: <OccurrenceFeaturePopup properties={feature.properties} />
          });
        }

        if (isBoundaryFeature(feature)) {
          if (feature.geometry.type === 'GeometryCollection') {
            continue;
          }

          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id,
            popup: <BoundaryFeaturePopup properties={feature.properties} />
          });
        }
      }
    }

    setStaticLayers([occurrenceStaticLayer, boundaryStaticLayer]);
    setMarkerLayers([occurrencesMarkerLayer]);
  }, [mapDataLoader.data]);

  mapDataLoader.load(ALL_OF_BC_BOUNDARY, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);

  return (
    <Box display="flex" flexDirection="column" width="100%" height="100%">
      <Box>
        <Typography variant="h1">Dataset Title</Typography>
      </Box>
      <Box data-testid="MapContainer">
        <MapContainer
          mapId="boundary_map"
          onBoundsChange={(bounds: LatLngBounds) => {
            const boundary = getFeatureObjectFromLatLngBounds(bounds);
            mapDataLoader.refresh(boundary, [
              SPATIAL_COMPONENT_TYPE.BOUNDARY,
              SPATIAL_COMPONENT_TYPE.OCCURRENCE
            ]);
          }}
          scrollWheelZoom={true}
          markerLayers={markerLayers}
          staticLayers={staticLayers}
        />
      </Box>
    </Box>
  );
};

export default DatasetPage;

export const isOccurrenceFeature = (feature: Feature): feature is OccurrenceFeature => {
  return feature.geometry.type === 'Point' && feature.properties?.['type'] === SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export const isBoundaryFeature = (feature: Feature): feature is BoundaryFeature => {
  return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY;
};
