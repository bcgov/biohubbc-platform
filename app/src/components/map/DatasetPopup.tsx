import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Collapse from '@material-ui/core/Collapse';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
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

const DatasetPopup: React.FC<{ submissionSpatialComponentId: number }> = (props) => {
  const { submissionSpatialComponentId } = props;

  const classes = useStyles();
  const api = useApi();

  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionSpatialComponentId);
  });

  dataLoader.load();

  const { isLoading, data, isReady } = dataLoader;
  console.log('dat:', data)

  const ModalContentWrapper: React.FC = ({ children }) => <div className={classes.modalContent}>{children}</div>;

  const MetadataHeader: React.FC<{ type: string; date?: string }> = (props) => (
    <Box mb={1}>
      <Typography variant="overline" className={classes.pointType}>
        {props.type || 'Dataset'}
      </Typography>
      {props.date && (
        <Typography className={classes.date} component="h6" variant="subtitle1">
          formatDate(props.date)
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
  const dwc = data.dwc;

  if (!dwc || !Object.keys(dwc).length) {
    return (
      <ModalContentWrapper>
        <MetadataHeader type={type} />
        <NoMetadataAvailable />
      </ModalContentWrapper>
    );
  }

  return (
    <ModalContentWrapper>
      <Collapse in={isReady}>
        <MetadataHeader type={type} date={dwc.eventDate} />
        <Table className={classes.table}>
          <TableBody>
            {Object.entries(dwc).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className={classes.tableCell}>{key}</TableCell>
                <TableCell className={classes.tableCell}>{String(value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Collapse>
    </ModalContentWrapper>
  );
};

export default DatasetPopup;
