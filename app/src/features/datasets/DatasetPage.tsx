import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress/CircularProgress';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { makeStyles } from '@mui/styles';
import { Buffer } from 'buffer';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { ALL_OF_BC_BOUNDARY, MAP_DEFAULT_ZOOM, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { DialogContext } from 'contexts/dialogContext';
import { Feature, Polygon } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { useContext, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router';
import { parseSpatialDataByType } from 'utils/spatial-utils';
import DatasetArtifacts from './components/DatasetArtifacts';
import RenderWithHandlebars from './components/RenderWithHandlebars';

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
  }
}));

const simsHandlebarsTemplate = `
  <div class="hbr-container">

    {{#if eml:eml.dataset.title}}
      <div>
        <h1> {{eml:eml.dataset.title}}</h1>
      </div>
    {{/if}}

    {{#if eml:eml.dataset.pubDate}}
      <div>
        <div class="meta-container">
          <div class="meta-title-container">
            Published
          </div>
          <div class="meta-body-container">
            {{eml:eml.dataset.pubDate}}
          </div>
        </div>
      </div>
    {{/if}}

    {{#if eml:eml.dataset.creator}}
      <div class="meta-container">
        <div class="meta-title-container">
            Creator
        </div>
        <div class="meta-body-container">
          <div>
            {{#if eml:eml.dataset.creator.organizationName}}
              <div>
                {{eml:eml.dataset.creator.organizationName}}
              </div>
            {{/if}}

            {{#if eml:eml.dataset.creator.electronicMailAddress}}
              <div>
                <a href="mailto: {{eml:eml.dataset.creator.electronicMailAddress}}">
                  {{eml:eml.dataset.creator.electronicMailAddress}}
                </a>
              </div>
            {{/if}}
          </div>
        </div>
      </div>
    {{/if}}

    {{#if eml:eml.dataset.metadataProvider}}
      <div class="meta-container">
        <div class="meta-title-container">
            Provider
        </div>
        <div class="meta-body-container">
          <div>
            <a href="mailto: {{eml:eml.dataset.metadataProvider.onlineUrl}}">
              {{eml:eml.dataset.metadataProvider.organizationName}}
            </a>
          </div>
        </div>
      </div>
    {{/if}}

    {{#each eml:eml.dataset.project.abstract.section as | section |}}
      {{#ifCond section.title '===' "Objectives"}}
        <div class="meta-container">
          <div class="meta-title-container">
            Objectives
          </div>
          <div class="meta-body-container">
            {{section.para}}
          </div>
        </div>
      {{/ifCond}}
    {{/each}}

    {{#if eml:eml.dataset.contact}}
      <div class="meta-container">
        <div class="meta-title-container">
          <div class="meta-title">
          Contacts
          </div>
        </div>
        <div class="meta-body-container">

          <div>
            {{#if eml:eml.dataset.contact.individualName.givenName}}
              {{eml:eml.dataset.contact.individualName.givenName}}
            {{/if}}
            {{#if eml:eml.dataset.contact.individualName.surName}}
              {{eml:eml.dataset.contact.individualName.surName}}
            {{/if}}
          </div>

          <div>
            {{#if eml:eml.dataset.contact.organizationName}}
              {{eml:eml.dataset.contact.organizationName}}
            {{/if}}
          </div>

          <div>
            {{#if eml:eml.dataset.creator.electronicMailAddress}}
              <a href="mailto:eml:eml.dataset.creator.electronicMailAddress}">
                {{eml:eml.dataset.creator.electronicMailAddress}}
              </a>
            {{/if}}
          </div>

        </div>
      </div>
    {{/if}}

    <div class="meta-container">
      {{#each eml:eml.additionalMetadata as | amd |}}
        {{#with (lookup amd.metadata "projectAttachments") as | attachments | ~}}

          <div class="meta-title-container">
            <div class="meta-title">
              Documents
            </div>
          </div>

          <div class="meta-body-container">

            {{#each attachments.projectAttachment as | a |}}
              <div>
                <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{a.file_name}}</a>
                {{#if a.is_secure}}
                  (secured)
                {{else}}
                  (public)
                {{/if}}
              </div>
            {{/each}}

            {{#if attachments.projectAttachment.file_name}}
              <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{attachments.projectAttachment.file_name}}</a>
              {{#if attachments.projectAttachment.is_secure}}
                (secured)
              {{else}}
                (public)
              {{/if}}
            {{/if}}
          </div>

        {{/with}}
      {{/each}}
    </div>


    <div class="meta-container">
      {{#each eml:eml.additionalMetadata as | amd |}}

        {{#with (lookup amd.metadata "projectReportAttachments") as | attachments | ~}}
          <div class="meta-title-container">
            <div class="meta-title">
              Reports
            </div>
          </div>
          <div class="meta-body-container">

            {{#each attachments.projectReportAttachment as | a |}}

            {{#if a.file_name}}
                <div>
                  <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{a.file_name}}</a>
                  {{#if a.is_secure}}
                    (secured)
                  {{else}}
                    (public)
                  {{/if}}
                </div>
              {{/if}}
            {{/each}}


            {{#if attachments.projectReportAttachment.file_name}}
              <a href="https://dev-biohubbc.apps.silver.devops.gov.bc.ca/"> {{attachments.projectReportAttachment.file_name}}</a>
              {{#if attachments.projectReportAttachment.is_secure}}
                (secured)
              {{else}}
                (public)
              {{/if}}
            {{/if}}
          </div>
        {{/with}}

      {{/each}}
    </div>
  </div>
`;

const DatasetPage: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();
  const biohubApi = useApi();
  const urlParams = useParams();
  const dialogContext = useContext(DialogContext);
  const history = useHistory();

  const datasetId = urlParams['id'];

  const datasetDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetEML(datasetId));

  const fileDataLoader = useDataLoader((searchBoundary: Feature, searchType: string[], searchZoom: number) =>
    biohubApi.search.getSpatialDataFile({
      boundary: [searchBoundary],
      type: searchType,
      zoom: searchZoom,
      datasetID: datasetId
    })
  );

  const attachmentsDataLoader = useDataLoader(() => biohubApi.dataset.getDatasetArtifacts(datasetId));

  attachmentsDataLoader.load();

  useDataLoaderError(datasetDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Dataset',
      dialogText:
        'An error has occurred while attempting to load the dataset, please try again. If the error persists, please contact your system administrator.',
      onOk: () => {
        datasetDataLoader.clear();
        dialogContext.setErrorDialog({ open: false });
        history.replace('/search');
      },
      onClose: () => {
        datasetDataLoader.clear();
        dialogContext.setErrorDialog({ open: false });
        history.replace('/search');
      }
    };
  });

  datasetDataLoader.load();

  const mapDataLoader = useDataLoader((searchBoundary: Feature, searchType: string[], searchZoom: number) =>
    biohubApi.search.getSpatialData({
      boundary: [searchBoundary],
      type: searchType,
      zoom: searchZoom,
      datasetID: datasetId
    })
  );

  useDataLoaderError(fileDataLoader, () => {
    return {
      dialogTitle: 'Error Exporting Data',
      dialogText:
        'An error has occurred while attempting to archive and download occurance data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  useDataLoaderError(mapDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Map Data',
      dialogText:
        'An error has occurred while attempting to load the map data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  const [markerLayers, setMarkerLayers] = useState<IMarkerLayer[]>([]);
  const [staticLayers, setStaticLayers] = useState<IStaticLayer[]>([]);

  const downloadDataSet = () => {
    fileDataLoader.refresh(
      ALL_OF_BC_BOUNDARY,
      [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE],
      MAP_DEFAULT_ZOOM
    );
  };

  useEffect(() => {
    if (!fileDataLoader.data) {
      return;
    }

    const data = fileDataLoader.data;

    const content = Buffer.from(data, 'hex');

    const blob = new Blob([content], { type: 'application/zip' });

    const link = document.createElement('a');

    link.download = `${datasetId}.zip`;

    link.href = URL.createObjectURL(blob);

    link.click();

    URL.revokeObjectURL(link.href);
  }, [datasetId, fileDataLoader.data]);

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }

    const result = parseSpatialDataByType(mapDataLoader.data);
    setStaticLayers(result.staticLayers);
    setMarkerLayers(result.markerLayers);
  }, [mapDataLoader.data]);

  const onMapViewChange = (bounds: Feature<Polygon>, newZoom: number) => {
    mapDataLoader.refresh(bounds, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE], newZoom);
  };

  mapDataLoader.load(
    ALL_OF_BC_BOUNDARY,
    [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE],
    MAP_DEFAULT_ZOOM
  );

  if (!datasetDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  return (
    <Box>
      <Paper square elevation={0} className={classes.datasetTitleContainer}>
        <Container maxWidth="xl">
          <RenderWithHandlebars datasetEML={datasetDataLoader} rawTemplate={simsHandlebarsTemplate} />
        </Container>
      </Paper>
      <Container maxWidth="xl">
        <Box pt={2}>
          <Paper elevation={0}>
            <DatasetArtifacts datasetId={datasetId} />
          </Paper>
        </Box>
      </Container>
      <Container maxWidth="xl">
        <Box py={2}>
          <Card data-testid="MapContainer">
            <Grid sx={{ justify: 'space-between', alignItems: 'center' }}>
              <Grid item>
                <Box px={2}>
                  <CardHeader
                    title="Occurrences"
                    titleTypographyProps={{ variant: 'h4', component: 'h2' }}></CardHeader>
                </Box>
              </Grid>
              <Grid item>
                <Box my={1} mx={2}>
                  <Button
                    color="primary"
                    variant="outlined"
                    disableElevation
                    aria-label={'Download occurrence'}
                    data-testid="export-occurrence"
                    startIcon={<Icon path={mdiDownload} size={1} />}
                    onClick={() => downloadDataSet()}>
                    Export Occurrences
                  </Button>
                </Box>
              </Grid>
            </Grid>
            <Box p={2} pt={0} className={classes.datasetMapContainer}>
              <MapContainer
                mapId="boundary_map"
                onBoundsChange={onMapViewChange}
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
