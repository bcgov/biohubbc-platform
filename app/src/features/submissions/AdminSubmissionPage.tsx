import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { makeStyles } from '@mui/styles';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import SubmissionHeader from './components/SubmissionHeader';

const useStyles = makeStyles((theme: Theme) => ({
  datasetTitleContainer: {
    paddingBottom: theme.spacing(5),
    background: '#f7f8fa',
    '& h1': {
      marginTop: '-4px'
    }
  },
  datasetDetailsLabel: {
    borderBottom: '1pt solid #dadada'
  },
  datasetDetailsContainer: {},
  datasetMapContainer: {
    minHeight: '400px'
  }
}));

const AdminSubmissionPage: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();

  return (
    <Box>
      <SubmissionHeader />
      <Container maxWidth="xl">
        <Box py={3}>
          <Paper elevation={0}>
            <ActionToolbar
              className={classes.datasetDetailsLabel}
              label="ADMIN DATASET DETAILS"
              labelProps={{ variant: 'h4' }}
            />
            <Box display="flex">
              <Box flex="1 1 auto" className={classes.datasetDetailsContainer}>
                {/* <RenderWithHandlebars datasetEML={datasetDataLoader} rawTemplate={templateDataLoader.data.details} /> */}
              </Box>
              <Box data-testid="MapContainer" p={3} flex="0 0 500px" className={classes.datasetMapContainer}>
                {/* <MapContainer
                  mapId="boundary_map"
                  bounds={mapBoundary}
                  scrollWheelZoom={false}
                  fullScreenControl={true}
                  markerLayers={markerLayers}
                  staticLayers={staticLayers}
                  zoomControlEnabled={true}
                  doubleClickZoomEnabled={false}
                  draggingEnabled={true}
                  layerControlEnabled={false}
                /> */}
              </Box>
            </Box>
          </Paper>
          <Box mt={3}>
            <Paper elevation={0}>{/* <DatasetArtifacts datasetId={datasetId} /> */}</Paper>
          </Box>
          <Box mt={3}>
            <Paper elevation={0}>{/* <RelatedDatasets datasetId={datasetId} /> */}</Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminSubmissionPage;
