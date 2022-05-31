import { Box } from '@material-ui/core';
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

export const OccurrenceFeaturePopup: React.FC<{ featureData: any }> = (props) => {
  const { featureData } = props;

  const classes = useStyles();

  const occurArray = [];

  for (const occur of featureData.dataPoints) {
    occurArray.push({
      printLine: `${occur.lifestage} - ${occur.sex} - ${
        occur.organismquantity
          ? `${occur.organismquantity} ${occur.organismquantitytype}`
          : `${occur.individualcount} Individuals`
      }`,
      date: occur.eventdate
    });
  }

  const pointArray: { points: string[]; date: string }[] = [];

  for (const occur of occurArray) {
    let flag = true;

    for (const point of pointArray) {
      if (occur.date == point.date) {
        point.points.push(occur.printLine);
        flag = false;
        break;
      }
    }

    if (flag) {
      pointArray.push({ points: [occur.printLine], date: occur.date });
    }
  }

  for (const item of pointArray) {
    item.points = item.points.sort();
  }

  return (
    <Popup className={classes.popUp} key={featureData.id} maxHeight={300} minWidth={300} keepInView={false} autoPan={false}>
      <h3>{featureData.taxonid} ( Lifestage - Sex - Count )</h3>
      <div>
        {pointArray.map((point) => {
          return (
            <div>
              {getFormattedDate(DATE_FORMAT.ShortMediumDateFormat2, point.date)}

              <Box component='ul' pl={3}>
                {point.points.map((occur) => {
                  return <li>{occur}</li>;
                })}
              </Box>
            </div>
          );
        })}
      </div>
    </Popup>
  );
};
