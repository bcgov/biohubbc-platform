import { SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import React from 'react';

export type OccurrenceFeature = Feature & { properties: OccurrenceFeatureProperties };

export type OccurrenceFeatureProperties = {
  type: SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export const OccurrenceFeaturePopup: React.FC<{ submissionId: number }> = (props) => {
  const { submissionId } = props;

  const api = useApi()
  const dataLoader = useDataLoader(() => {
    return api.search.getSpatialMetadata(submissionId)
  })
  
  dataLoader.load()

  const { isLoading, data, isReady } = dataLoader

  console.log('rendered!')
  return (
    <div>
      {isLoading ? (
        <div>Loading</div>
      ) : <>
        {isReady && (
          <div>{JSON.stringify(data)}</div>
        )}
      </>}
    </div>
  );
};
