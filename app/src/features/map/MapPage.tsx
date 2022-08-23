import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import intersect from '@turf/intersect';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { ALL_OF_BC_BOUNDARY, MAP_DEFAULT_ZOOM, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { Feature, Polygon } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import useURL from 'hooks/useURL';
import { useEffect, useRef, useState } from 'react';
import { parseSpatialDataByType } from 'utils/spatial-utils';

const MapPage: React.FC<React.PropsWithChildren> = () => {
  const api = useApi();

  const url = useURL<{
    mapViewBoundary: Feature<Polygon> | undefined;
    drawnBoundary: Feature<Polygon> | undefined;
    type: string[] | undefined;
    zoom: number | undefined;
  }>();

  const mapDataLoader = useDataLoader((searchBoundary: Feature, searchType: string[], searchZoom: number) =>
    api.search.getSpatialData({ boundary: searchBoundary, type: searchType, zoom: searchZoom })
  );

  const loadedFromUrl = useRef(false);

  useDataLoaderError(mapDataLoader, () => {
    return {
      dialogTitle: 'Error Loading Map Data',
      dialogText:
        'An error has occurred while attempting to load map data, please try again. If the error persists, please contact your system administrator.'
    };
  });

  const [mapViewBoundary, setMapViewBoundary] = useState<Feature<Polygon> | undefined>(url.queryParams.mapViewBoundary);
  const [drawnBoundary, setDrawnBoundary] = useState<Feature<Polygon> | undefined>(url.queryParams.drawnBoundary);

  const [type] = useState<string[]>(url.queryParams.type || [SPATIAL_COMPONENT_TYPE.BOUNDARY_CENTROID]);
  const [zoom] = useState<number>(url.queryParams.zoom || MAP_DEFAULT_ZOOM);

  const [markerLayers, setMarkerLayers] = useState<IMarkerLayer[]>([]);
  const [staticLayers, setStaticLayers] = useState<IStaticLayer[]>([]);

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }

    const result = parseSpatialDataByType(mapDataLoader.data);

    setStaticLayers(result.staticLayers);
    setMarkerLayers(result.markerLayers);
  }, [mapDataLoader.data]);

  useEffect(() => {
    if (!loadedFromUrl.current) {
      loadedFromUrl.current = true;
      if (drawnBoundary) {
        const searchBoundary = getSearchBoundary(mapViewBoundary, drawnBoundary);
        mapDataLoader.refresh(searchBoundary, type, zoom);
      }
    }
  });

  const getSearchBoundary = (boundary1?: Feature<Polygon>, boundary2?: Feature<Polygon>) => {
    return (boundary2 && boundary1 && intersect(boundary2, boundary1)) || boundary1 || boundary2 || ALL_OF_BC_BOUNDARY;
  };

  const onMapViewChange = (bounds: Feature<Polygon>, newZoom: number) => {
    // Store map view boundary
    setMapViewBoundary(bounds);

    // Store map view bounds in URL
    url.appendQueryParams({ mapViewBoundary: bounds, zoom: newZoom });
  };

  const onDrawChange = (features: Feature[]) => {
    // In this case, we have disabled all draw controls except Polygons, and limited it to only 1 at a time, so
    // assuming the type should be safe. This will need to be updated if the draw control options are changed.
    const bounds = features?.[0] as Feature<Polygon> | undefined;

    // Store user drawn boundary
    setDrawnBoundary(bounds);

    // Calculate search boundary based on drawn and map view boundaries
    const searchBoundary = getSearchBoundary(mapViewBoundary, bounds);

    // Store drawn bounds in URL
    url.appendQueryParams({ drawnBoundary: bounds });

    mapDataLoader.refresh(searchBoundary, type, zoom);
  };

  return (
    <Box width="100%" height="100%">
      <Typography variant="h1" hidden>
        Map
      </Typography>
      <Box width="100%" height="100%" data-testid="MapContainer">
        <MapContainer
          mapId="boundary_map"
          onBoundsChange={onMapViewChange}
          drawControls={{
            initialFeatures: drawnBoundary && [drawnBoundary],
            options: {
              // Disable all controls except for Polygon (and Rectangle, which is just a type of Polygon)
              draw: { circle: false, circlemarker: false, marker: false, polyline: false }
            },
            // Limit drawing to 1 shape at a time
            clearOnDraw: true
          }}
          onDrawChange={onDrawChange}
          scrollWheelZoom={true}
          fullScreenControl={true}
          markerLayers={markerLayers}
          staticLayers={staticLayers}
        />
      </Box>
    </Box>
  );
};

export default MapPage;
