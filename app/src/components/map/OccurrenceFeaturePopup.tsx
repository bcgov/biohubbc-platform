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
export interface IGetMapOccurrenceData {
  id: number;
  taxonid: string | undefined;
  geometry: string | undefined;
  observations: [
    {
      eventdate: string | undefined;
      data: [
        {
          lifestage: string | undefined;
          vernacularname: string | undefined;
          sex: string | undefined;
          individualcount: number | undefined;
          organismquantity: number | undefined;
          organismquantitytype: string | undefined;
        }
      ];
    }
  ];
}

export const OccurrenceFeaturePopup: React.FC<{ featureData: IGetMapOccurrenceData }> = (props) => {
  const { featureData } = props;

  const classes = useStyles();

  return (
    <Popup
      className={classes.popUp}
      key={featureData.id}
      maxHeight={300}
      minWidth={250}
      keepInView={false}
      autoPan={false}>
      <h3>{featureData.taxonid} ( Lifestage - Sex - Count )</h3>
      <div>
        {featureData.observations.map((point) => {
          return (
            <div key={point.eventdate}>
              {getFormattedDate(DATE_FORMAT.ShortMediumDateFormat2, point.eventdate || '')}

              <Box component="ul" pl={3}>
                {point.data.map((occur) => {
                  return (
                    <li key={String(occur.lifestage) + String(occur.sex) + String(occur.individualcount) }>
                      {`${occur.lifestage} - ${occur.sex} - ${
                        occur.organismquantity
                          ? `${occur.organismquantity} ${occur.organismquantitytype}`
                          : `${occur.individualcount} Individuals`
                      }`}
                    </li>
                  );
                })}
              </Box>
            </div>
          );
        })}
      </div>
    </Popup>
  );
};
