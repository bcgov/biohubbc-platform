import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { BoundaryFeaturePopup, BoundaryFeatureProperties } from 'components/map/BoundaryFeaturePopup';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { OccurrenceFeaturePopup, OccurrenceFeatureProperties } from 'components/map/OccurrenceFeaturePopup';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { LatLngBounds, LatLngTuple } from 'leaflet';
import React, { useEffect, useState } from 'react';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';

export const ALL_OF_BC_FEATURE: Feature = {
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

const MapPage: React.FC = () => {
  const api = useApi();

  const mapDataLoader = useDataLoader((boundary: Feature, type: string) =>
    api.search.getSpatialData({ boundary: boundary, type: type })
  );

  useDataLoaderError(mapDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Map Data',
      dialogText:
        'An error has occurred while attempting to load the map data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  // @ts-ignore
  const [markerLayers, setMarkerLayers] = useState<IMarkerLayer[]>([]);
  // @ts-ignore
  const [staticLayers, setStaticLayers] = useState<IStaticLayer[]>([]);

  const isOccurrenceFeature = (feature: Feature) => {
    return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.OCCURRENCE;
  };

  const isBoundaryFeature = (feature: Feature) => {
    return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY;
  };

  useEffect(() => {
    if (!mapDataLoader.data?.length) {
      return;
    }

    let occurrencesMarkerLayer: IMarkerLayer = { layerName: LAYER_NAME.OCCURRENCES, markers: [] };
    let boundaryStaticLayer: IStaticLayer = { layerName: LAYER_NAME.BOUNDARIES, features: [] };

    for (const featureCollection of mapDataLoader.data) {
      for (const feature of featureCollection.features) {
        if (isOccurrenceFeature(feature)) {
          if (feature.geometry.type === 'GeometryCollection') {
            continue;
          }

          if (feature.geometry.type === 'Point') {
            occurrencesMarkerLayer.markers.push({
              position: feature.geometry.coordinates as LatLngTuple,
              key: feature.id,
              popup: <OccurrenceFeaturePopup properties={feature.properties as OccurrenceFeatureProperties} />
            });
            continue;
          }
        }

        if (isBoundaryFeature(feature)) {
          if (feature.geometry.type === 'GeometryCollection') {
            continue;
          }

          boundaryStaticLayer.features.push({
            geoJSON: feature,
            key: feature.id,
            popup: <BoundaryFeaturePopup properties={feature.properties as BoundaryFeatureProperties} />
          });
        }
      }
    }

    setStaticLayers([boundaryStaticLayer]);
    setMarkerLayers([occurrencesMarkerLayer]);
  }, [mapDataLoader.data]);

  // const processFeatureCollection = (featureCollection: FeatureCollection) {
  //   for(const feature of featureCollection) {
  //     geoJSONMarkers.concat(processSpatialResponse([item])
  //   }
  // }

  // const processSpatialResponse = (feature: Feature) => {
  //   const geoJSONMarkers = [];

  //   for (const item of objs) {
  //     if (item.type === 'Feature') {
  //       const geo = JSON.parse(item.geometry);
  //       geoJSONMarkers.push({
  //         position: geo.coordinates,
  //         popup: <OccurrenceFeaturePopup featureData={item} />
  //       });
  //     } else if (item.type === 'FeatureCollection') {
  //       for (const feature of item.features) {
  //         geoJSONMarkers.push({
  //           position: feature.geometry,
  //           popup: <OccurrenceFeaturePopup featureData={feature} />
  //         });
  //       }
  //     } else if (item.type === 'GeometryCollection') {
  //       const geo = JSON.parse(item.geometry);
  //       geoJSONMarkers.push({
  //         position: geo.coordinates,
  //         popup: <OccurrenceFeaturePopup featureData={item} />
  //       });
  //     } else {
  //       geoJSONMarkers.push({
  //         position: item.coordinates,
  //         popup: <OccurrenceFeaturePopup featureData={item} />
  //       });
  //     }

  //     setMarkers(geoJSONMarkers);
  //   }
  // };

  mapDataLoader.load(ALL_OF_BC_FEATURE, 'Boundary');

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5} display="flex" justifyContent="space-between">
          <Typography variant="h1">Map</Typography>
        </Box>
        <Box>
          <Box mb={4}>
            <Grid item xs={12}>
              <Box mt={2} height={750} data-testid="MapContainer">
                <MapContainer
                  mapId="boundary_map"
                  onBoundsChange={(bounds: LatLngBounds) => {
                    const boundary = getFeatureObjectFromLatLngBounds(bounds);
                    mapDataLoader.refresh(boundary, 'Boundary');
                  }}
                  scrollWheelZoom={true}
                  markerLayers={markerLayers}
                  staticLayers={staticLayers}
                />
              </Box>
            </Grid>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default MapPage;
