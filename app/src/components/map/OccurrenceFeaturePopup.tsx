import { DATE_FORMAT } from 'constants/dateTimeFormats';
import React from 'react';
import { Popup } from 'react-leaflet';
import { getFormattedDate } from 'utils/Utils';

export const OccurrenceFeaturePopup: React.FC<{ featureData: any }> = (props) => {
  const { featureData } = props;

  // console.log('featureData:', featureData);

  return (
    <Popup key={featureData.occurrence_id} keepInView={false} autoPan={false}>
      <div>
        <b>Species</b>
        {`: ${featureData.taxonid}`}
      </div>
      <div>
        <b>Lifestage</b>
        {`: ${featureData.lifestage}`}
      </div>
      <div>
        <b>Sex</b>
        {`: ${featureData.sex}`}
      </div>
      <div>
        <b>Count</b>
        {`: ${
          featureData.organismquantity
            ? `${featureData.organismquantity} ${featureData.organismquantitytype}`
            : `${featureData.individualcount} Individuals`
        }`}
      </div>
      <div>
        <b>Date</b>
        {`: ${getFormattedDate(DATE_FORMAT.ShortMediumDateFormat2, featureData.eventdate)}`}
      </div>
    </Popup>
  );
};
