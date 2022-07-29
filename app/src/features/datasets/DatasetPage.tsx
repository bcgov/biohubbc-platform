import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import CircularProgress from '@material-ui/core/CircularProgress/CircularProgress';
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
import { useParams } from 'react-router';
import { parseFeatureCollectionsByType } from 'utils/spatial-utils';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

const useStyles = makeStyles((theme: Theme) => ({
  datasetTitleContainer: {
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(5),
    background: '#ffffff',
    '& h1': {
      marginTop: '-4px'
    }
  },
  datasetMapContainer: {
    width: '100%',
    aspectRatio: '1 / 0.5',
    borderRadius: '6px',
    paddingBottom: '16px'
  },
}));

const DatasetPage: React.FC = () => {
  const classes = useStyles();
  const api = useApi();
  const urlParams = useParams();

  const datasetId = urlParams['id'];

  const datasetDataLoader = useDataLoader(() => api.dataset.getDatasetEML(datasetId));

  useDataLoaderError(datasetDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Dataset',
      dialogText:
        'An error has occurred while attempting to load the dataset, please try again. If the error persists, please contact your system administrator.'
    };
  });

  datasetDataLoader.load();

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

    const result = parseFeatureCollectionsByType(mapDataLoader.data.map((item) => item.spatial_data));

    setStaticLayers(result.staticLayers);
    setMarkerLayers(result.markerLayers);
  }, [mapDataLoader.data]);

  mapDataLoader.load(ALL_OF_BC_BOUNDARY, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);

  if (!datasetDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  return (
    <Box>
      <Paper square elevation={0} className={classes.datasetTitleContainer}>
        <Container maxWidth="xl">
          <Typography variant="h1">{datasetDataLoader?.data['eml:eml'].dataset.title}</Typography>
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box py={5}>
          <Card data-testid="MapContainer">
            <CardHeader title="OCCURRENCES" disableTypography></CardHeader>
            <Box p={2} pt={0} className={classes.datasetMapContainer}>
              <MapContainer
                mapId="boundary_map"
                onBoundsChange={(bounds: LatLngBounds) => {
                  const boundary = getFeatureObjectFromLatLngBounds(bounds);
                  mapDataLoader.refresh(boundary, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);
                }}
                scrollWheelZoom={true}
                fullScreenControl={true}
                markerLayers={markerLayers}
                staticLayers={staticLayers}
              />
            </Box>
          </Card>
        </Box>
      </Container>
    </Box>
  );
};

export default DatasetPage;
