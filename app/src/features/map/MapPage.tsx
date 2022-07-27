import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { ALL_OF_BC_BOUNDARY, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { LatLngBounds } from 'leaflet';
import React, { useEffect, useState } from 'react';
import { parseFeatureCollectionsByType } from 'utils/spatial-utils';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';

const MapPage: React.FC = () => {
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

    const result = parseFeatureCollectionsByType(mapDataLoader.data);

    setStaticLayers(result.staticLayers);
    setMarkerLayers(result.markerLayers);
  }, [mapDataLoader.data]);

  mapDataLoader.load(ALL_OF_BC_BOUNDARY, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);

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
                    mapDataLoader.refresh(boundary, [
                      SPATIAL_COMPONENT_TYPE.BOUNDARY,
                      SPATIAL_COMPONENT_TYPE.OCCURRENCE
                    ]);
                  }}
                  drawControls={{
                    options: {
                      draw: { circle: false, circlemarker: false, marker: false, polyline: false },
                      edit: { edit: false, remove: false }
                    },
                    onChange: (features: Feature[]) => {
                      console.log('Drawn features', features);
                    },
                    clearOnDraw: true
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
