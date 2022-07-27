import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { BoundaryFeature } from 'components/map/BoundaryFeaturePopup';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { OccurrenceFeature } from 'components/map/OccurrenceFeaturePopup';
import { ALL_OF_BC_BOUNDARY, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import { LatLngBounds } from 'leaflet';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { parseFeatureCollectionsByType } from 'utils/spatial-utils';
import { getFeatureObjectFromLatLngBounds } from 'utils/Utils';


const DatasetPage: React.FC = () => {
  const api = useApi();
  const urlParams = useParams();

  const datasetId = urlParams['id'];

  const datasetDataLoader = useDataLoader(() => api.dataset.getDatasetEML(datasetId));

  useDataLoaderError(datasetDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Dataset',
      dialogText:
        'An error has occurred while attempting to load the dataset, please try again. If the error persists, please contact your system administrator.'
    };
  });

  datasetDataLoader.load();

  const mapDataLoader = useDataLoader((boundary: Feature, type: string[]) =>
    api.search.getSpatialData({ boundary: boundary, type: type })
  );

  useDataLoaderError(mapDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Map Data',
      dialogText:
        'An error has occurred while attempting to load the map data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  const [markerLayers, setMarkerLayers] = useState<IMarkerLayer[]>([]);
  const [staticLayers, setStaticLayers] = useState<IStaticLayer[]>([]);

  useEffect(() => {
    if (!mapDataLoader.data?.length) {
      return;
    }

    const result = parseFeatureCollectionsByType(mapDataLoader.data);

    setStaticLayers(result.staticLayers);
    setMarkerLayers(result.markerLayers);
  }, [mapDataLoader.data]);

  mapDataLoader.load(ALL_OF_BC_BOUNDARY, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);

  if (!datasetDataLoader.data) {
    return <CircularProgress className="pageProgress" size={40} />;
  }

  return (
    <Box display="flex" flexDirection="column" width="100%" height="100%">
      <Box flex="0 0 auto" p={3}>
        <Typography variant="h1">{datasetDataLoader?.data['eml:eml'].dataset.title}</Typography>
      </Box>
      <Box flex="1 1 auto" data-testid="MapContainer">
        <MapContainer
          mapId="boundary_map"
          onBoundsChange={(bounds: LatLngBounds) => {
            const boundary = getFeatureObjectFromLatLngBounds(bounds);
            mapDataLoader.refresh(boundary, [SPATIAL_COMPONENT_TYPE.BOUNDARY, SPATIAL_COMPONENT_TYPE.OCCURRENCE]);
          }}
          scrollWheelZoom={true}
          markerLayers={markerLayers}
          staticLayers={staticLayers}
        />
      </Box>
    </Box>
  );
};

export default DatasetPage;

export const isOccurrenceFeature = (feature: Feature): feature is OccurrenceFeature => {
  return feature.geometry.type === 'Point' && feature.properties?.['type'] === SPATIAL_COMPONENT_TYPE.OCCURRENCE;
};

export const isBoundaryFeature = (feature: Feature): feature is BoundaryFeature => {
  return feature?.properties?.['type'] === SPATIAL_COMPONENT_TYPE.BOUNDARY;
};
