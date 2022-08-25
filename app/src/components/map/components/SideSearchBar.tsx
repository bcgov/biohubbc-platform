import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import { Form, Formik, FormikProps } from 'formik';
import { Feature } from 'geojson';
// import { useApi } from 'hooks/useApi';
import { useRef } from 'react';

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

export interface SideSearchBarProps {
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
}

const SideSearchBar: React.FC<SideSearchBarProps> = (props) => {
  // const api = useApi();
  // const [updatedBounds, setUpdatedBounds] = useState<LatLngBoundsExpression | undefined>(undefined);

  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  // console.log('formikRef in the map page', formikRef);

  /**
   * Handle dataset requests.
   */
  const handleDatasetRequestCreation = async (values: IDatasetSearchForm) => {
    // try {
    const searchParams: any = {
      criteria: {
        boundary: { type: 'Feature', geometry: [{ type: 'Polygon' }], properties: {} },
        type: ['a'],
        species: values.species_list,
        zoom: 2, // TODO include in request params when backend is updated to receive it
        datasetID: 'string',
        datasetName: values.dataset
      }
    };

    console.log('values', values);
    console.log('searchParams', searchParams);
    console.log('formikref.values in Side searchbar', formikRef.current?.values);

    return;
    // await api.search.getSpatialData(searchParams.criteria);

    // if (!response?.satasetID) {
    //   showCreateErrorDialog({
    //     dialogError: 'The response from the server was null, or did not contain a project ID.'
    //   });
    //   return;
    // }
    // } catch (error) {
    //   showCreateErrorDialog({
    //     //dialogTitle: 'Error Finding Dataset',
    //     dialogError: 'Some error' //(error as APIError)?.message,
    //     // dialogErrorDetails: (error as APIError)?.errors
    //   });
    // }
  };

  // //User uploads boundary for search
  // const onAreaUpload = (area: IFormikAreaUpload) => {
  //   //Get points inside bounds
  //   const featureArray: Feature[] = [];
  //   area.features.forEach((feature: Feature<Polygon>) => {
  //     const newFeature: Feature = {
  //       type: 'Feature',
  //       geometry: simplify(feature.geometry, { tolerance: 0.01, highQuality: false }),
  //       properties: feature.properties
  //     };
  //     featureArray.push(newFeature);
  //   });

  //   // const geoCollection:Feature<GeometryCollection> = {};
  //   mapDataLoader.refresh(featureArray[0], type, zoom);

  //   //SET BOUNDS
  //   const bounds = calculateUpdatedMapBounds(area.features);
  //   if (bounds) {
  //     const newBounds = new LatLngBounds(bounds[0] as LatLngTuple, bounds[1] as LatLngTuple);
  //     setShouldUpdateBounds(true);
  //     setUpdatedBounds(newBounds);
  //   }

  //   //SET STATIC LAYER
  //   const layers: IStaticLayerFeature[] = [];
  //   area.features.forEach((feature: Feature<Polygon>) => {
  //     const staticLayerFeature: IStaticLayerFeature = {
  //       geoJSON: feature,
  //       tooltip: <AreaToolTip name={area.name} />
  //     };
  //     layers.push(staticLayerFeature);
  //   });
  //   const staticLayer: IStaticLayer = { layerName: area.name, features: layers };
  //   setStaticLayers([...staticLayers, staticLayer]);
  // };

  return (
    <Box component={Paper} p={4} width={500}>
      <Formik<IDatasetSearchForm>
        innerRef={formikRef}
        enableReinitialize={true}
        initialValues={DatasetSearchFormInitialValues}
        validationSchema={DatasetSearchFormYupSchema}
        validateOnBlur={true}
        validateOnChange={false}
        onSubmit={handleDatasetRequestCreation}>
        {(formikProps) => (
          <Form>
            <Box my={2}>
              <Grid container direction="column" justifyContent="center" spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h3">Find BioHub Data</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Box component="fieldset" width={'100%'}>
                    <DatasetSearchForm
                      onAreaUpdate={props.onAreaUpdate}
                      speciesList={[
                        { value: '1', label: 'Moose' },
                        { value: '2', label: 'Thinhorn sheep' },
                        { value: '3', label: 'Bighorn sheep' }
                      ]}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Box mt={5} display="flex" justifyContent="flex-end">
              <Button
                fullWidth={true}
                onClick={formikProps.submitForm}
                variant="contained"
                color="primary"
                size="large"
                type="submit"
                data-testid="dataset-find-button">
                Find Data
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

// function showCreateErrorDialog(arg0: { dialogError: string }) {
//   throw new Error('Function not implemented.');
// }

export default SideSearchBar;
