import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button } from '@mui/material';
import simplify from '@turf/simplify';
import { ErrorDialog } from 'components/dialog/ErrorDialog';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import SearchResultOccurrenceList from 'features/datasets/components/SearchResultOccurrenceList';
import SearchResultProjectList, { IDatasetVisibility } from 'features/datasets/components/SearchResultProjectList';
import { Form, Formik, FormikProps } from 'formik';
import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { useEffect, useRef, useState } from 'react';

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
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
}

const SideSearchBar: React.FC<SideSearchBarProps> = (props) => {
  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  const [showForm, setShowForm] = useState(true);
  const [showNoData, setShowNoData] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [datasetType, setDatasetType] = useState<string>('');
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

    props.mapDataLoader.refresh(featureArray, [values.dataset], values.species_list);
    setFormData(values);
    setDatasetType(values.dataset);
  };

  useEffect(() => {
    setShowSpinner(true);
    if (props.mapDataLoader.isReady) {
      if (!props.mapDataLoader.data?.length) {
        setShowNoData(true);
      } else {
        setShowForm(false);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mapDataLoader.isLoading, props.mapDataLoader.isReady]);

  return (
    <>
      <ErrorDialog
        dialogTitle="No Data Found"
        dialogText="Please refine search"
        open={showNoData}
        onClose={() => setShowNoData(false)}
        onOk={() => setShowNoData(false)}
      />
      {showForm && (
        <Formik<IDatasetSearchForm>
          innerRef={formikRef}
          enableReinitialize={true}
          initialValues={formData || DatasetSearchFormInitialValues}
          validationSchema={DatasetSearchFormYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={handleDatasetRequestCreation}>
          {(formikProps) => (
            <Form>
              <DatasetSearchForm
                onAreaUpdate={props.onAreaUpdate}
                speciesList={[
                  { value: 'M-ALAL', label: 'Moose (M-ALAL)' },
                  { value: 'M-ORAM', label: 'Mountain Goat (M-ORAM)' },
                  { value: 'M-OVDA', label: 'Thinhorn sheep (M-OVDA)' },
                  { value: 'M-OVDA-DA', label: 'Thinhorn sheep (M-OVDA-DA)' },
                  { value: 'M-OVDA-ST', label: 'Thinhorn sheep (M-OVDA-ST)' },
                  { value: 'M-OVCA', label: 'Bighorn sheep (M-OVCA)' },
                  { value: 'B-SPOW', label: 'Spotted Owl (B-SPOW)' }
                ]}
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
          )}
        </Formik>
      )}

      {!showForm &&
        (datasetType === 'Boundary Centroid' ? (
          <SearchResultProjectList
            mapDataLoader={props.mapDataLoader}
            backToSearch={() => setShowForm(true)}
            onToggleDataVisibility={props.onToggleDataVisibility}
          />
        ) : (
          <SearchResultOccurrenceList
            mapDataLoader={props.mapDataLoader}
            backToSearch={() => setShowForm(true)}
            onToggleDataVisibility={props.onToggleDataVisibility}
          />
        ))}
    </>
  );
};

export default SideSearchBar;
