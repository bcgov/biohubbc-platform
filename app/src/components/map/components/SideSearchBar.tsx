import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button } from '@mui/material';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import simplify from '@turf/simplify';
import { ErrorDialog } from 'components/dialog/ErrorDialog';
import { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import SearchResultList, { IDatasetVisibility, ISearchResult } from 'features/datasets/components/SearchResultList';
import { Form, Formik, FormikProps } from 'formik';
import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { useEffect, useRef, useState } from 'react';

export interface IDatasetRequest {
  criteria: {
    boundary: Feature;
    type: string[];
    species?: IMultiAutocompleteFieldOption[];
    zoom?: number; // TODO include in request params when backend is updated to receive it
    datasetID?: string;
    datasetName?: string;
  };
}

export interface SideSearchBarProps {
  mapDataLoader: DataLoader<
    [
      searchBoundary: Feature<Geometry, GeoJsonProperties>[],
      searchType: string[],
      species?: string[],
      searchZoom?: number,
      datasetID?: string
    ],
    ISpatialData[],
    unknown
  >;
  searchResults: ISearchResult[];
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
}

const SideSearchBar: React.FC<SideSearchBarProps> = (props) => {
  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  const [showForm, setShowForm] = useState(true);
  const [showNoData, setShowNoData] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const [formData, setFormData] = useState<IDatasetSearchForm | null>(null);
  /**
   * Handle dataset requests.
   */
  const handleDatasetRequestCreation = async (values: IDatasetSearchForm) => {
    const featureArray: Feature[] = [];
    values.area.forEach((area: IFormikAreaUpload) => {
      area.features.forEach((feature: Feature<Polygon>) => {
        const newFeature: Feature = {
          type: 'Feature',
          geometry: simplify(feature.geometry, { tolerance: 0.01, highQuality: false }),
          properties: feature.properties
        };
        featureArray.push(newFeature);
      });
    });

    const species_array: string[] = [];
    values.species_list.forEach((item) => {
      species_array.push(item.value.toString());
    });

    props.mapDataLoader.refresh(featureArray, [values.dataset], species_array);
    setFormData(values);
  };

  const toggleForm = () => {
    setShowForm(!showForm);
  };

  useEffect(() => {
    setShowSpinner(true);
    if (props.mapDataLoader.isReady) {
      if (!props.mapDataLoader.data?.length) {
        setShowNoData(true);
        setShowForm(true)
      } else {
        setShowForm(false);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mapDataLoader.isLoading, props.mapDataLoader.isReady]);

  const hasResults = (): boolean => {
    return props.searchResults.length > 0
  }

  return (
    <>
      <ErrorDialog
        dialogTitle="No Records Found"
        dialogText="No records were found that matched your search criteria. Please refine your search and try again."
        open={showNoData}
        onClose={() => setShowNoData(false)}
        onOk={() => setShowNoData(false)}
      />
      {showForm && (
        <Box display="flex" flexDirection="column" height="100%" overflow="hidden">
          <Box flex="0 0 auto">
            <Box display="flex" alignItems="center" justifyContent="space-between" p={3}>
              <Typography variant="h3" component="h1">
                Map Search
              </Typography>
              {hasResults() && (
                <Button
                  variant="text"
                  color="primary"
                  onClick={toggleForm}
                  sx={{
                    my: -1,
                    fontWeight: 700,
                    color: 'text.secondary'
                  }}>
                  BACK TO RESULTS
                </Button>
              )}
            </Box>
            <Divider></Divider>
          </Box>
          <Box
            flex="1 1 auto"
            sx={{
              overflowY: 'auto'
            }}>
            <Formik<IDatasetSearchForm>
              innerRef={formikRef}
              enableReinitialize={true}
              initialValues={formData || DatasetSearchFormInitialValues}
              validationSchema={DatasetSearchFormYupSchema}
              validateOnBlur={true}
              validateOnChange={false}
              onSubmit={handleDatasetRequestCreation}>
              {(formikProps) => (
                <Box py={4} px={3}>
                  <Form>
                    <DatasetSearchForm
                      hasResults={hasResults()}
                      toggleForm={toggleForm}
                      onAreaUpdate={props.onAreaUpdate}
                    />

                    <Box mt={4}>
                      {showSpinner &&
                        (props.mapDataLoader.isLoading ? (
                          <LoadingButton
                            fullWidth={true}
                            loading
                            variant="contained"
                            color="primary"
                            size="large"
                            type="button"
                            data-testid="dataset-find-button"
                            sx={{
                              fontWeight: 700
                            }}>
                            Submit
                          </LoadingButton>
                        ) : (
                          <Button
                            fullWidth={true}
                            onClick={formikProps.submitForm}
                            variant="contained"
                            color="primary"
                            size="large"
                            type="button"
                            data-testid="dataset-find-button"
                            sx={{
                              fontWeight: 700
                            }}>
                            Find Data
                          </Button>
                        ))}
                    </Box>
                  </Form>
                </Box>
              )}
            </Formik>
          </Box>
        </Box>
      )}

      {!showForm && hasResults() && (
        <SearchResultList
          searchResults={props.searchResults}
          backToSearch={() => toggleForm()}
          onToggleDataVisibility={props.onToggleDataVisibility}
        />
      )}
    </>
  );
};

export default SideSearchBar;
