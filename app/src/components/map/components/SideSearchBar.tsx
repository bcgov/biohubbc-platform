import { Box, Button, Grid, Paper, Typography } from '@mui/material';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import { Form, Formik, FormikProps } from 'formik';
import { Feature } from 'geojson';
import { useApi } from 'hooks/useApi';
import { useRef } from 'react';
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

const SideSearchBar: React.FC<React.PropsWithChildren> = () => {
  const api = useApi();

  const formikRef = useRef<FormikProps<IFindDataset>>(null);
  console.log('formikRef in the map page', formikRef);

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

  return (
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
              <Button variant="contained" color="primary" size="large" type="submit" data-testid="dataset-find-button">
                Find
              </Button>
            </Box>
          </Form>
        </>
      </Formik>
    </Box>
  );
};

function showCreateErrorDialog(arg0: { dialogError: string }) {
  throw new Error('Function not implemented.');
}

export default SideSearchBar;
