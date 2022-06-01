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

  // const tester = () => {

  //   console.log('////////////////////////////////////////////////////');
  // };
  //   [
  //   {
  //     "type": "Feature",
  //     "properties": {},
  //     "geometry": {
  //       "type": "Polygon",
  //       "coordinates": [
  //         [
  //           [
  //             -129.149437,
  //             55.354526
  //           ],
  //           [
  //             -129.149437,
  //             55.422779
  //           ],
  //           [
  //             -128.983955,
  //             55.422779
  //           ],
  //           [
  //             -128.983955,
  //             55.354526
  //           ],
  //           [
  //             -129.149437,
  //             55.354526
  //           ]
  //         ]
  //       ]
  //     }
  //   }
  // ]

  const getOccurrenceData = useCallback(
    async (bounds?: any) => {
      console.log('getOccurrenceData bopubnds', bounds);
      try {
        let spatialBounds: Feature = {} as unknown as Feature;

        if (bounds) {
          spatialBounds = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [bounds._northEast.lat, bounds._northEast.lng],
                  [bounds._northEast.lat, bounds._northEast.lng],
                  [bounds._southWest.lat, bounds._southWest.lng],
                  [bounds._southWest.lat, bounds._southWest.lng],
                  [bounds._northEast.lat, bounds._northEast.lng]

                ]
              ]
            }
          } as Feature;
        }

        console.log('spatialBounds', spatialBounds);

        const response = await platformApi.search.getMapOccurrenceData(bounds ? spatialBounds : undefined);

        if (!response) {
          setPerformSearch(false);
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

        setPerformSearch(false);
        setGeometries(markers);

        // console.log('clusteredPointGeometries:', markers);
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
                  getOccurrenceData={getOccurrenceData}
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
