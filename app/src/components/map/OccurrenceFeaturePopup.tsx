import { CircularProgress, Collapse, makeStyles, Table, TableBody, TableCell, TableRow, Theme, Typography } from '@material-ui/core';
import { SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';

export type OccurrenceFeature = Feature & { properties: OccurrenceFeatureProperties };

export type OccurrenceFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.OCCURRENCE;
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
  date: {
    margin: 0
  },
  table: {
    marginTop: 16
  },
  tableCell: {
    padding: 8,
    fontSize: '0.625rem'
  }
}));

export const OccurrenceFeaturePopup: React.FC<{ submissionSpatialComponentId: number }> = (props) => {
  const { submissionSpatialComponentId } = props;

  const classes = useStyles()
  const api = useApi()
  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionSpatialComponentId)
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toDateString()
  }
  
  dataLoader.load()

  const { isLoading, data, isReady } = dataLoader
  const { date, type, ...rest } = data || {} // as Record<string, any>

  return (
    <div className={classes.modalContent}>
      {isLoading && (
        <div className={classes.loading}>
          <CircularProgress size={24} color='primary' />
        </div>
      )}
      <Collapse in={isReady}>
        <div>
          <Typography variant='overline'>{type}</Typography>
          <Typography className={classes.date} component='h6' variant='body1'>{formatDate(date)}</Typography>
          {rest && (
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
          )}
        </div>
      </Collapse>
    </div>
  );
};
