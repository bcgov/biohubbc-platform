import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Collapse from '@material-ui/core/Collapse';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Typography from '@material-ui/core/Typography';
import { SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';

export type OccurrenceFeature = Feature & { properties: OccurrenceFeatureProperties };

export type OccurrenceFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export type BoundaryFeature = Feature & { properties: BoundaryFeatureProperties };

export type BoundaryFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.BOUNDARY;
};

export type BoundaryCentroidFeature = Feature & { properties: BoundaryCentroidFeatureProperties };

export type BoundaryCentroidFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID;
};

const useStyles = makeStyles(() => ({
  modalContent: {
    position: 'relative',
    width: 300,
    minHeight: 36
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  },
  pointType: {
    lineHeight: 'unset'
  },
  date: {
    margin: 0,
    lineHeight: 'unset'
  },
  table: {
    marginTop: 16
  },
  tableCell: {
    padding: 8,
    fontSize: '0.625rem'
  }
}));

interface IDatasetSpatialMetadata {
  datasetTitle: string
  type: 'Boundary Centroid'
}

const DatasetPopup: React.FC<{ submissionSpatialComponentId: number }> = (props) => {
  const { submissionSpatialComponentId } = props;

  const classes = useStyles();
  const api = useApi();

  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionSpatialComponentId);
  });

  dataLoader.load();

  const { isLoading, isReady } = dataLoader;
  const data = dataLoader.data as IDatasetSpatialMetadata

  const ModalContentWrapper: React.FC = ({ children }) => <div className={classes.modalContent}>{children}</div>;

  const MetadataHeader: React.FC<{ type: string; title?: string }> = (props) => (
    <Box mb={1}>
      <Typography variant="overline" className={classes.pointType}>
        {props.type || 'Boundary Centroid'}
      </Typography>
      {props.title && (
        <Typography className={classes.date} component="h6" variant="subtitle1">
          {props.title}
        </Typography>
      )}
    </Box>
  );

  const NoMetadataAvailable: React.FC = () => (
    <Typography className={classes.date} component="h6" variant="body1">
      No metadata available.
    </Typography>
  );

  if (isLoading) {
    return (
      <ModalContentWrapper>
        <div className={classes.loading}>
          <CircularProgress size={24} color="primary" />
        </div>
      </ModalContentWrapper>
    );
  }

  if (!data) {
    return (
      <ModalContentWrapper>
        <NoMetadataAvailable />
      </ModalContentWrapper>
    );
  }

  const type = data.type;
  const datasetTitle = data.datasetTitle;

  return (
    <ModalContentWrapper>
      <Collapse in={isReady}>
        <MetadataHeader type={type} title={datasetTitle} />
        <Button color='primary' variant='contained' onClick={() => null}>Go to Dataset</Button>
      </Collapse>
    </ModalContentWrapper>
  );
};

export default DatasetPopup;
