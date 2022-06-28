import makeStyles from '@material-ui/core/styles/makeStyles';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import React from 'react';
import { Popup } from 'react-leaflet';
import { getFormattedDate } from 'utils/Utils';

const useStyles = makeStyles(() => ({
  popUp: {
    '& .leaflet-popup-content': {
      paddingRight: '0',
      marginRight: '0'
    }
  }
}));

export type OccurrenceFeatureProperties = {
  type: 'Occurrence';
  id: number;
  taxonid: string;
  eventDate: string;
};

export const FeaturePopup: React.FC<{ properties: OccurrenceFeatureProperties }> = (props) => {
  const { properties } = props;

  const classes = useStyles();

  return (
    <Popup
      className={classes.popUp}
      key={properties.id}
      maxHeight={300}
      minWidth={250}
      keepInView={false}
      autoPan={false}>
      <div>
        <div key={properties.id}>
          {getFormattedDate(DATE_FORMAT.ShortMediumDateFormat2, properties.eventDate || '')}
        </div>
      </div>
    </Popup>
  );
};
