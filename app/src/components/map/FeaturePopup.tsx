import { Box, CircularProgress, Collapse, makeStyles, Table, TableBody, TableCell, TableRow, Theme, Typography } from '@material-ui/core';
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

const useStyles = makeStyles((theme: Theme) => ({
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

const FeaturePopup: React.FC<{ submissionSpatialComponentId: number }> = (props) => {
  const { submissionSpatialComponentId } = props;

  const classes = useStyles()
  const api = useApi()
  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionSpatialComponentId)
  })

  /**
   * @TODO Replace this with moment/luxon date formatter
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date as unknown as number)
      ? date.toDateString()
      : dateString
  }
  
  dataLoader.load()

  const { isLoading, data, isReady } = dataLoader
  const { date, type, ...rest } = data || {}

  console.log('rest:', rest)

  return (
    <div className={classes.modalContent}>
      {isLoading && (
        <div className={classes.loading}>
          <CircularProgress size={24} color='primary' />
        </div>
      )}
      <Collapse in={isReady}>
        <div>
          <Box mb={1}>
            <Typography variant='overline' className={classes.pointType}>{type || 'Feature'}</Typography>
            {date && (
              <Typography className={classes.date} component='h6' variant='subtitle1'>
                {formatDate(date)}
              </Typography>
            )}
          </Box>
          {rest && Object.keys(rest).length > 0 ? (
            <Table className={classes.table}>
              <TableBody>
                {Object.entries(rest).map(([key, value]) => (
                  <TableRow>
                    <TableCell className={classes.tableCell}>
                      {key}
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      {value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography className={classes.date} component='h6' variant='body1'>No metadata available.</Typography>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default FeaturePopup
