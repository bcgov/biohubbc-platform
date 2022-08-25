import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import SearchResultList, { IDataType } from 'features/datasets/components/SearchResultList';
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
const SideSearchBar: React.FC<React.PropsWithChildren> = () => {
  // const api = useApi();

  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  console.log('formikRef in the map page', formikRef);

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
  const tempData: IDataType[] = [
    {
        dataset_id: '12314123',
        dataset_name: 'Moose',
        number_of_records: 4
    },
    {
        dataset_id: '1231-4123',
        dataset_name: 'Bears',
        number_of_records: 2
    },
    {
        dataset_id: '123124131223',
        dataset_name: 'Ducks',
        number_of_records: 5
    },
    {
        dataset_id: '1241241314123',
        dataset_name: 'Deer',
        number_of_records: 6
    }
]
  return (
    <Box component={Paper} p={4} width={400}>
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
                      speciesList={[
                        { value: 'species1', label: 'species 1' },
                        { value: 'species2', label: 'species 2' }
                      ]}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Box mt={5} display="flex" justifyContent="flex-end">
              <Button
                onClick={formikProps.submitForm}
                variant="contained"
                color="primary"
                size="large"
                type="submit"
                data-testid="dataset-find-button">
                Find
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
      <Box mt={5} display="flex" flexDirection={"column"}>
        <SearchResultList items={tempData} toggleDataSet={(dataSetId)=>{console.log(`Toggle: ${dataSetId}`)}}/>
      </Box>
    </Box>
  );
};

// function showCreateErrorDialog(arg0: { dialogError: string }) {
//   throw new Error('Function not implemented.');
// }

export default SideSearchBar;
