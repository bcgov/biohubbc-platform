import { Container, Grid, Typography } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import MapContainer from 'components/map/MapContainer';
// import { useApi } from 'hooks/useApi';
import React from 'react';

const MapPage: React.FC = () => {

  // const platformApi = useApi();

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
                scrollWheelZoom={true}
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
