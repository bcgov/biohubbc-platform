import { Container, Grid, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { IMarker } from 'components/map/components/MarkerCluster';
import MapContainer from 'components/map/MapContainer';
import { IGetMapOccurrenceData, OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { DialogContext } from 'contexts/dialogContext';
import { Feature } from 'geojson';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { LatLngBounds } from 'leaflet';
import React, { useCallback, useContext, useEffect, useState } from 'react';

const MapPage: React.FC = () => {
  const platformApi = useApi();

  const [performSearch, setPerformSearch] = useState<boolean>(true);
  const [geometries, setGeometries] = useState<any[]>([]);

  const dialogContext = useContext(DialogContext);

  const showFilterErrorDialog = useCallback(
    (textDialogProps?: Partial<IErrorDialogProps>) => {
      dialogContext.setErrorDialog({
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        ...textDialogProps,
        open: true
      });
    },
    [dialogContext]
  );

  const getOccurrenceData = useCallback(
    async (bounds?: LatLngBounds) => {
      try {
        let spatialBounds: Feature = {} as unknown as Feature;

        if (bounds) {
          const southWest = bounds.getSouthWest();
          const northEast = bounds.getNorthEast();

          spatialBounds = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [southWest.lng, southWest.lat],
                  [southWest.lng, northEast.lat],
                  [northEast.lng, northEast.lat],
                  [northEast.lng, southWest.lat],
                  [southWest.lng, southWest.lat]
                ]
              ]
            }
          } as Feature;
        }

        const response = await platformApi.search.getMapOccurrenceData(bounds ? spatialBounds : undefined);

        if (!response) {
          return;
        }

        const markers: IMarker[] = [];

        response.forEach((result: IGetMapOccurrenceData) => {
          if (result?.geometry) {
            const geo = JSON.parse(result?.geometry);

            markers.push({
              position: geo.coordinates,
              popup: <OccurrenceFeaturePopup featureData={result} />
            });
          }
        });

        setGeometries(markers);
      } catch (error) {
        const apiError = error as APIError;
        showFilterErrorDialog({
          dialogTitle: 'Error Searching For Results',
          dialogError: apiError?.message,
          dialogErrorDetails: apiError?.errors
        });
      }
    },
    [platformApi.search, showFilterErrorDialog]
  );

  useEffect(() => {
    if (performSearch) {
      getOccurrenceData();
      setPerformSearch(false);
    }
  }, [performSearch, getOccurrenceData]);

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5} display="flex" justifyContent="space-between">
          <Typography variant="h1">Map</Typography>
        </Box>
        <Box>
          <Box mb={4}>
            <Grid item xs={12}>
              <Box mt={2} height={750}>
                <MapContainer
                  mapId="boundary_map"
                  onBoundsChange={getOccurrenceData}
                  scrollWheelZoom={true}
                  markers={geometries}
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
