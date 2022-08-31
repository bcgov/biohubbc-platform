import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import intersect from '@turf/intersect';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import SideSearchBar from 'components/map/components/SideSearchBar';
import { IStaticLayer, IStaticLayerFeature } from 'components/map/components/StaticLayers';
import MapContainer from 'components/map/MapContainer';
import { AreaToolTip, IFormikAreaUpload } from 'components/upload/UploadArea';
import { ALL_OF_BC_BOUNDARY, MAP_DEFAULT_ZOOM, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import { IDatasetVisibility, ISearchResult } from 'features/datasets/components/SearchResultOccurrenceList';
import { Feature, Polygon } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import useURL from 'hooks/useURL';
import { LatLngBounds, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { calculateUpdatedMapBounds } from 'utils/mapUtils';
import { ILayers, newParseSpatialDataByType, parseSpatialDataByType } from 'utils/spatial-utils';

const MapPage: React.FC<React.PropsWithChildren> = () => {
  const api = useApi();

  const url = useURL<{
    mapViewBoundary: Feature<Polygon> | undefined;
    drawnBoundary: Feature<Polygon> | undefined;
    type: string[] | undefined;
    zoom: number | undefined;
  }>();

  const mapDataLoader = useDataLoader(
    (searchBoundary: Feature[], searchType: string[], species?: string[], searchZoom?: number, datasetID?: string) =>
      api.search.getSpatialData({
        boundary: searchBoundary,
        type: searchType,
        species: species,
        zoom: searchZoom,
        datasetID: datasetID
      })
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
  const [shouldUpdateBounds, setShouldUpdateBounds] = useState<boolean>(false);
  const [updatedBounds, setUpdatedBounds] = useState<LatLngBoundsExpression | undefined>(undefined);
  const [areaStaticLayers, setAreaStaticLayers] = useState<IStaticLayer[]>([]);
  const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({});

  const [layers, setLayers] = useState<ILayers>({ markerLayer: {}, staticLayer: {} });

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }

    console.log("___ DATA VISIBILITY ___")
    console.log(datasetVisibility)

    const result = parseSpatialDataByType(mapDataLoader.data, datasetVisibility);
    const results = newParseSpatialDataByType(mapDataLoader.data)
    setLayers(results)

    const markerLayers = Object.keys(results.markerLayer).map(key => {
      const item = results.markerLayer[key];
      item.visible = datasetVisibility[key] !== undefined ? datasetVisibility[key] : true
      return item
    })

    const staticLayers = Object.keys(results.staticLayer).map(key => {
      const item = results.staticLayer[key];
      item.visible = datasetVisibility[key] !== undefined ? datasetVisibility[key] : true
      return item
    })

    setMarkerLayers(markerLayers);
    setStaticLayers(staticLayers);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapDataLoader.data, datasetVisibility]);

  useEffect(() => {
    if (!loadedFromUrl.current) {
      loadedFromUrl.current = true;
      if (drawnBoundary) {
        const searchBoundary = getSearchBoundary(mapViewBoundary, drawnBoundary);
        mapDataLoader.refresh([searchBoundary], type, [], zoom);
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

    mapDataLoader.refresh([searchBoundary], type, [], zoom);
  };

  const onAreaUpdate = (areas: IFormikAreaUpload[]) => {
    const staticLayers: IStaticLayer[] = [];
    const featureArray: Feature[] = [];

    areas.forEach((area) => {
      const layers: IStaticLayerFeature[] = [];
      area.features.forEach((feature: Feature<Polygon>) => {
        const staticLayerFeature: IStaticLayerFeature = {
          geoJSON: feature,
          tooltip: <AreaToolTip name={area.name} />
        };
        layers.push(staticLayerFeature);
        featureArray.push(feature);
      });
      const staticLayer: IStaticLayer = { layerName: area.name, features: layers, visible: true };
      staticLayers.push(staticLayer);
    });

    setAreaStaticLayers(staticLayers);
    setBounds(featureArray);
  };

  const setBounds = (features: Feature[]) => {
    const bounds = calculateUpdatedMapBounds(features);

    if (bounds) {
      const newBounds = new LatLngBounds(bounds[0] as LatLngTuple, bounds[1] as LatLngTuple);
      setShouldUpdateBounds(true);
      setUpdatedBounds(newBounds);
    } else {
      const boundsBC = calculateUpdatedMapBounds([ALL_OF_BC_BOUNDARY]);
      if (boundsBC) {
        const newBounds = new LatLngBounds(boundsBC[0] as LatLngTuple, boundsBC[1] as LatLngTuple);
        setShouldUpdateBounds(true);
        setUpdatedBounds(newBounds);
      }
    }
  };

  const onToggleDataVisibility = (datasets: IDatasetVisibility) => {
    console.log("IS THE TOGGLE RUNNING?")
    setDatasetVisibility(datasets);
  };

  const converMarkerToSearchResult = () => {
    return Object.keys(layers?.markerLayer).map(key => {
      const item = layers?.markerLayer[key];
      const searchResult = {
        key: key,
        name: item.layerName,
        count: item.markers.length,
        visible: datasetVisibility[key] !== undefined ? datasetVisibility[key] : true
      } as ISearchResult
      return searchResult
    })
  }

  const converStaticLayerToSearchResult = () => {
    return Object.keys(layers?.staticLayer).map(key => {
      const item = layers?.staticLayer[key];
      const searchResult = {
        key: key,
        name: item.layerName,
        count: item.features.length,
        visible: datasetVisibility[key] !== undefined ? datasetVisibility[key] : true
      } as ISearchResult
      return searchResult
    })
  }

  return (
    <Box display="flex" justifyContent="space-between" width="100%" height="100%">
      <Paper
        square
        elevation={3}
        sx={{
          flex: '0 0 auto',
          width: '500px',
          py: 4,
          px: 3,
          position: 'relative',
          zIndex: '999'
        }}>
        <SideSearchBar
          searchResults={[... converMarkerToSearchResult(), ... converStaticLayerToSearchResult()]}
          mapDataLoader={mapDataLoader}
          onAreaUpdate={onAreaUpdate}
          onToggleDataVisibility={onToggleDataVisibility}
        />
      </Paper>
      <Box flex="1 1 auto" height="100%" data-testid="MapContainer">
        <MapContainer
          mapId="boundary_map"
          onBoundsChange={() => onMapViewChange}
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
          staticLayers={[...staticLayers, ...areaStaticLayers]}
          bounds={(shouldUpdateBounds && updatedBounds) || undefined}
        />
      </Box>
    </Box>
  );
};

export default MapPage;
