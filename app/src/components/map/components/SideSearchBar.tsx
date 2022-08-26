import { Box, Button } from '@mui/material';
import simplify from '@turf/simplify';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import SearchResultList, { IDatasetVisibility, IDataType } from 'features/datasets/components/SearchResultList';
import { Form, Formik, FormikProps } from 'formik';
import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { useRef, useState } from 'react';

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
  onDatasetToggleVisibility: (datasets: IDatasetVisibility) => void;
}

const SideSearchBar: React.FC<SideSearchBarProps> = (props) => {
  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  const [showForm, setShowForm] = useState(false)

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

    // const geoCollection:Feature<GeometryCollection> = {};
    props.mapDataLoader.refresh(featureArray, [values.dataset], values.species_list);
  };

  // //User uploads boundary for search
  // const onAreaUpload = (area: IFormikAreaUpload) => {
  //   //SET BOUNDS
  //   const bounds = calculateUpdatedMapBounds(area.features);
  //   if (bounds) {
  //     const newBounds = new LatLngBounds(bounds[0] as LatLngTuple, bounds[1] as LatLngTuple);
  //     setShouldUpdateBounds(true);
  //     setUpdatedBounds(newBounds);
  //   }
  // };

  const toggleForm = () => {
    setShowForm(!showForm);
  }

  const temp: IDataType[] = [
    {
      dataset_id: "62",
      dataset_name: "Moose",
      number_of_records: 1
    },
    {
      dataset_id: "55-22-44-44",
      dataset_name: "Ducks",
      number_of_records: 15
    }
  ]

  return (
    <>
    {showForm && 
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
            <DatasetSearchForm
              onAreaUpdate={props.onAreaUpdate}
              speciesList={[
                { value: 'M-ALAM', label: 'Moose' },
                { value: 'M-ORAM', label: 'Mountain Goat' },
                { value: 'M-OVDA', label: 'Thinhorn sheep' },
                { value: 'M-OVCA', label: 'Bighorn sheep' },
                { value: 'B-SPOW', label: 'Spotted Owl' }
              ]}
            />

            <Box mt={4}>
              <Button
                fullWidth={true}
                onClick={formikProps.submitForm}
                variant="contained"
                color="primary"
                size="large"
                type="submit"
                data-testid="dataset-find-button"
                sx={{
                  fontWeight: 700
                }}>
                Find Data
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    }
      
    {!showForm && 
      <SearchResultList
        items={temp} 
        backToSearch={() => toggleForm()}
        toggleDataSet={props.onDatasetToggleVisibility}
      />
    }
    </>
  );
};

// function showCreateErrorDialog(arg0: { dialogError: string }) {
//   throw new Error('Function not implemented.');
// }

export default SideSearchBar;
