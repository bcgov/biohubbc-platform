import { Container, Grid, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { IMarker } from 'components/map/components/MarkerCluster';
import MapContainer from 'components/map/MapContainer';
import { OccurrenceFeaturePopup } from 'components/map/OccurrenceFeaturePopup';
import { DialogContext } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import React, { useCallback, useContext, useEffect, useState } from 'react';
// import { generateValidGeometryCollection } from 'utils/mapUtils';

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

  const getOccurrenceData = useCallback(async () => {
    try {
      const response = await platformApi.search.getOccurrenceData();

      if (!response) {
        setPerformSearch(false);
        return;
      }

      // console.log('response:', response);

      const markers: IMarker[] = [];

      response.forEach((result: any) => {
        if (result?.geometry) {
          const geo = JSON.parse(result?.geometry);
          // console.log('result:', result);
          // console.log('geo:', geo);
          // console.log('geometry.type:', geo.type);
          // console.log('geometry.coordinates:', geo.coordinates);

          markers.push({
            position: geo.coordinates,
            popup: <OccurrenceFeaturePopup featureData={result}/>
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
  }, [platformApi.search, showFilterErrorDialog]);

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
                <MapContainer mapId="boundary_map" scrollWheelZoom={true} markers={geometries}/>
              </Box>
            </Grid>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default MapPage;
