import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import { Feature } from 'geojson';
import { useState } from 'react';

import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { getFormattedDate, makeCsvObjectUrl } from 'utils/Utils';

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

interface IMetadataHeaderProps {
  type?: string;
  date?: string;
  index?: number;
  length?: number;
  downloadHref?: string
}

const useStyles = makeStyles(() => ({
  modalContent: {
    position: 'relative',
    width: 300,
    minHeight: 36,
  },
  metadata: {
    maxHeight: 300,
    overflowY: 'scroll'
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

const FeaturePopup: React.FC<React.PropsWithChildren<{ submissionSpatialComponentIds: number[] }>> = (props) => {
  const { submissionSpatialComponentIds } = props;

  const classes = useStyles();
  const api = useApi();
  const [currentIndex, setCurrentIndex] = useState(0)

  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionSpatialComponentIds);
  });

  dataLoader.load();
  
  const { isLoading, isReady } = dataLoader;
  const data = dataLoader.data || []
  const isEmpty = !data || data.length === 0
  const metadataObjectUrl = isEmpty ? undefined : makeCsvObjectUrl(data.map((row) => row.dwc))

  const handleNext = () => {
    if (isEmpty) {
      return
    }

    setCurrentIndex((currentIndex + 1) % data.length)
  }

  const handlePrev = () => {
    if (isEmpty) {
      return
    }
    if (currentIndex === 0) {
      setCurrentIndex(data.length - 1)
    } else {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const ModalContentWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <div className={classes.modalContent}>{children}</div>
  );

  const MetadataHeader: React.FC<React.PropsWithChildren<IMetadataHeaderProps>> = (headerProps) => {
    const { type, date, index, length, downloadHref } = headerProps

    return (
      <Box mb={1}>
        <Typography component="h6" variant="subtitle1" className={classes.pointType}>
          {type || 'Feature'} record {length && length > 0 && `(${(index || 0) + 1} of ${length})`}
        </Typography>
        {downloadHref && (
          <Button href={downloadHref}>Download Records as CSV</Button>
        )}
        {date && (
          <Typography className={classes.date} component="h6" variant="subtitle1">
            {getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, date)}
          </Typography>
        )}
      </Box>
    );
  }

  const NoMetadataAvailable: React.FC<React.PropsWithChildren> = () => (
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

  if (data.length === 0) {
    return (
      <ModalContentWrapper>
        <NoMetadataAvailable />
      </ModalContentWrapper>
    );
  }

  const metadata = data[currentIndex]
  const type = metadata?.type;
  const dwc = metadata?.dwc;

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
      <MetadataHeader type={type} index={currentIndex} length={data.length} downloadHref={metadataObjectUrl} />
      <Collapse in={isReady} className={classes.metadata}>
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
      {!isEmpty && length > 1 && (
        <Box display='flex' sx={{ gap: 1 }} mt={1}>
          <Button size='small' variant='contained' onClick={() => handlePrev()}>Prev</Button>
          <Button size='small' variant='contained' color='primary' onClick={() => handleNext()}>Next</Button>
        </Box>
      )}
    </ModalContentWrapper>
  )

};

export default FeaturePopup;
