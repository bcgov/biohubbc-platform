import { Container, Grid, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import MapContainer from 'components/map/MapContainer';
import { OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { FeatureCollection, GeoJSON } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { LatLngBounds } from 'leaflet';
import React, { useState } from 'react';

const MapPage: React.FC = () => {
  const api = useApi();

  const mapDataLoader = useDataLoader(
    () => api.search.getSpatialData({ boundary: {}, type: 'Boundary' }),
    undefined,
    false
  );

  useDataLoaderError(mapDataLoader, () => {
    return {};
  });

  const [markers, setMarkers] = useState<any[]>([]);

  const processFeatureCollection (featureCollection: FeatureCollection) {
    for(item of featureCollection) {
      geoJSONMarkers.concat(processSpatialResponse([item])
    }
  }

  const processSpatialResponse = (objs: GeoJSON[]) => {
    const geoJSONMarkers = [];

    for (const item of objs) {
      if (item.type === 'Feature') {
        const geo = JSON.parse(item.geometry);
        geoJSONMarkers.push({
          position: geo.coordinates,
          popup: <OccurrenceFeaturePopup featureData={item} />
        });
      } else if (item.type === 'FeatureCollection') {
        for (const feature of item.features) {
          geoJSONMarkers.push({
            position: feature.geometry,
            popup: <OccurrenceFeaturePopup featureData={feature} />
          });
        }
      } else if (item.type === 'GeometryCollection') {
        // const geo = JSON.parse(item.geometry);
        // geoJSONMarkers.push({
        //   position: geo.coordinates,
        //   popup: <OccurrenceFeaturePopup featureData={item} />
        // });
      } else {
        geoJSONMarkers.push({
          position: item.coordinates,
          popup: <OccurrenceFeaturePopup featureData={item} />
        });
      }

      setMarkers(geoJSONMarkers);
    }
  };

  // const getOccurrenceData = useCallback(
  //   async (bounds?: LatLngBounds) => {
  //     try {
  //       let spatialBounds: Feature = {} as unknown as Feature;

  //       if (bounds) {
  //         spatialBounds = getFeatureObjectFromLatLngBounds(bounds);
  //       }

  //       const response = await platformApi.search.getMapOccurrenceData(bounds ? spatialBounds : undefined);

  //       if (!response) {
  //         return;
  //       }

  //       const markers: IMarker[] = [];

  //       response.forEach((result: IGetMapOccurrenceData) => {
  //         if (result?.geometry) {
  //           const geo = JSON.parse(result?.geometry);

  //           markers.push({
  //             position: geo.coordinates,
  //             popup: <OccurrenceFeaturePopup featureData={result} />
  //           });
  //         }
  //       });

  //       setGeometries(markers);
  //     } catch (error) {
  //       const apiError = error as APIError;
  //       showFilterErrorDialog({
  //         dialogTitle: 'Error Searching For Results',
  //         dialogError: apiError?.message,
  //         dialogErrorDetails: apiError?.errors
  //       });
  //     }
  //   },
  //   [platformApi.search, showFilterErrorDialog]
  // );

  // useEffect(() => {
  //   if (performSearch) {
  //     getOccurrenceData();
  //     setPerformSearch(false);
  //   }
  // }, [performSearch, getOccurrenceData]);

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
                  onBoundsChange={(bounds: LatLngBounds) => mapDataLoader.refresh()}
                  scrollWheelZoom={true}
                  markers={markers}
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
