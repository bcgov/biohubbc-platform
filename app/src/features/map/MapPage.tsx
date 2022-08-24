import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import intersect from '@turf/intersect';
import simplify from '@turf/simplify';
import { IMarkerLayer } from 'components/map/components/MarkerCluster';
import { IStaticLayer, IStaticLayerFeature } from 'components/map/components/StaticLayers';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import MapContainer from 'components/map/MapContainer';
import { AreaToolTip, IFormikAreaUpload } from 'components/upload/UploadArea';
import { ALL_OF_BC_BOUNDARY, MAP_DEFAULT_ZOOM, SPATIAL_COMPONENT_TYPE } from 'constants/spatial';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import { Form, Formik, FormikProps } from 'formik';
import { Feature, Polygon } from 'geojson';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDataLoaderError from 'hooks/useDataLoaderError';
import useURL from 'hooks/useURL';
import { LatLngBounds, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { calculateUpdatedMapBounds } from 'utils/mapUtils';
import { parseSpatialDataByType } from 'utils/spatial-utils';
import yup from 'utils/YupSchema';

export interface IDatasetRequest {
  criteria: {
    boundary: Feature;
    type: string[];
    species?: string[];
    zoom?: number; // TODO include in request params when backend is updated to receive it
    datasetID?: string;
    datasetName?: string;
  };
}

export interface IFindDataset extends IDatasetRequest, IDatasetSearchForm {}

export const DatasetFormInitialValues: IDatasetRequest = {
  criteria: {
    boundary: null as unknown as Feature,
    type: ['Boundary'],
    species: ['species1', 'species2'],
    zoom: 0,
    datasetID: 'abc',
    datasetName: 'Species Observations'
  }
};

export const FindDatasetInitialValues = {
  ...DatasetFormInitialValues,
  ...DatasetSearchFormInitialValues
};

export const DatasetFormYupSchema = yup.object().shape({
  criteria: yup.object().shape({
    boundary: yup.mixed(),
    type: yup.array(),
    species: yup.array(),
    zoom: yup.number().notRequired(),
    datasetID: yup.string(),
    datasetName: yup.string().notRequired()
  })
});

export const FindDatasetYupSchema = yup.object().concat(DatasetFormYupSchema).concat(DatasetSearchFormYupSchema);

const MapPage: React.FC<React.PropsWithChildren> = () => {
  const api = useApi();
  //const dialogContext = useContext(DialogContext);

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
  const [shouldUpdateBounds, setShouldUpdateBounds] = useState<boolean>(false);
  const [updatedBounds, setUpdatedBounds] = useState<LatLngBoundsExpression | undefined>(undefined);

  useEffect(() => {
    setShouldUpdateBounds(false);
  }, [updatedBounds]);

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }

    const result = parseSpatialDataByType(mapDataLoader.data);

    setStaticLayers([...staticLayers, result.staticLayers[0]]);
    setMarkerLayers(result.markerLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const formikRef = useRef<FormikProps<IFindDataset>>(null);

  // const showFindErrorDialog = (textDialogProps?: Partial<IErrorDialogProps>) => {
  //   dialogContext.setErrorDialog({
  //     dialogTitle: CreateProjectI18N.createErrorTitle,
  //     dialogText: CreateProjectI18N.createErrorText,
  //     ...defaultErrorDialogProps,
  //     ...textDialogProps,
  //     open: true
  //   });
  // };

  /**
   * Handle dataset requests.
   */
  const handleDatasetRequestCreation = async (values: IDatasetRequest) => {
    try {
      await api.search.getSpatialData(values.criteria);

      // if (!response?.satasetID) {
      //   showCreateErrorDialog({
      //     dialogError: 'The response from the server was null, or did not contain a project ID.'
      //   });
      //   return;
      // }
    } catch (error) {
      showCreateErrorDialog({
        //dialogTitle: 'Error Finding Dataset',
        dialogError: 'Some error' //(error as APIError)?.message,
        // dialogErrorDetails: (error as APIError)?.errors
      });
    }
  };

  console.log('formikRef in the map page', formikRef);

  //User uploads boundary for search
  const onAreaUpload = (area: IFormikAreaUpload) => {
    //Get points inside bounds
    const featureArray: Feature[] = [];
    area.features.forEach((feature: Feature<Polygon>) => {
      const newFeature: Feature = {
        type: 'Feature',
        geometry: simplify(feature.geometry, { tolerance: 0.01, highQuality: false }),
        properties: feature.properties
      };
      featureArray.push(newFeature);
    });

    // const geoCollection:Feature<GeometryCollection> = {};
    mapDataLoader.refresh(featureArray[0], type, zoom);

    //SET BOUNDS
    const bounds = calculateUpdatedMapBounds(area.features);
    if (bounds) {
      const newBounds = new LatLngBounds(bounds[0] as LatLngTuple, bounds[1] as LatLngTuple);
      setShouldUpdateBounds(true);
      setUpdatedBounds(newBounds);
    }

    //SET STATIC LAYER
    const layers: IStaticLayerFeature[] = [];
    area.features.forEach((feature: Feature<Polygon>) => {
      const staticLayerFeature: IStaticLayerFeature = {
        geoJSON: feature,
        tooltip: <AreaToolTip name={area.name} />
      };
      layers.push(staticLayerFeature);
    });
    const staticLayer: IStaticLayer = { layerName: area.name, features: layers };
    setStaticLayers([...staticLayers, staticLayer]);
  };

  return (
    <Box display="flex" justifyContent="space-between" width="100%" height="100%">
      <Box component={Paper} p={4}>
        <Formik<IFindDataset>
          innerRef={formikRef}
          enableReinitialize={true}
          initialValues={FindDatasetInitialValues}
          validationSchema={FindDatasetYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={handleDatasetRequestCreation}>
          <>
            <Form noValidate>
              <Box my={5}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Box my={5}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                          <Typography variant="h3">Map search</Typography>
                        </Grid>
                        <Grid item xs={12} md={9}>
                          <Box component="fieldset" mx={0}>
                            <DatasetSearchForm
                              searchCriteria={{
                                dataset: ['item 1', 'item 2'],
                                species_list: [
                                  { value: 'species1', label: 'species 1' },
                                  { value: 'species2', label: 'species 2' }
                                ]
                              }}
                            />
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Box mt={5} display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  type="submit"
                  data-testid="dataset-find-button">
                  Find
                </Button>
              </Box>
            </Form>
          </>
        </Formik>
      </Box>
      <Box data-testid="MapContainer" width="100%" height="100%">
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
          staticLayers={staticLayers}
          bounds={(shouldUpdateBounds && updatedBounds) || undefined}
        />
        <UploadAreaControls onAreaUpload={onAreaUpload} />
      </Box>
    </Box>
  );
};

export default MapPage;
function showCreateErrorDialog(arg0: { dialogError: string }) {
  throw new Error('Function not implemented.');
}
