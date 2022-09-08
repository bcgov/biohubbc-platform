import { InputLabel } from '@mui/material';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import MultiSelectList from 'components/fields/MultiSelectList';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import { useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import React, { useEffect, useState } from 'react';
import yup from 'utils/YupSchema';

export interface IDatasetSearchForm {
  dataset: string;
  species_list: IMultiAutocompleteFieldOption[];
  area: IFormikAreaUpload[];
}

export const DatasetSearchFormInitialValues: IDatasetSearchForm = {
  dataset: 'Occurrence',
  species_list: [],
  area: []
};

export const DatasetSearchFormYupSchema = yup.object().shape({
  dataset: yup.string(),
  species_list: yup.mixed(),
  area: yup.mixed()
});

export interface IDatasetSearchFormProps {
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
}

/**
 * Create project - Partnerships section
 *
 * @return {*}
 */
const DatasetSearchForm: React.FC<IDatasetSearchFormProps> = (props) => {
  const api = useApi();

  const formikProps = useFormikContext<IDatasetSearchForm>();

  const [speciesList, setSpeciesList] = useState<IMultiAutocompleteFieldOption[]>([]);

  const convertOptions = (value: any): IMultiAutocompleteFieldOption[] =>
    value.map((item: any) => {
      return { value: item.code, label: item.label };
    });

  const handleGetSpeciesList = async (value: string) => {
    const response = await api.taxonomy.searchSpecies(value);

    const convertedOptions = convertOptions(response.searchResponse);

    setSpeciesList(convertedOptions);
  };

  useEffect(() => {
    props.onAreaUpdate(formikProps.values.area);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formikProps.values.area]);

  return (
    <>
      <Typography
        variant="h3"
        component="h1"
        sx={{
          mb: 4
        }}>
        Map Search
      </Typography>
      <Box component="fieldset">
        <Box
          component="legend"
          mb={2}
          p={0}
          sx={{
            fontWeight: 700
          }}>
          What do you want to find?
        </Box>
        <FormControl fullWidth>
          <InputLabel id="dataset-menu">Dataset</InputLabel>
          <Select
            fullWidth={true}
            id={`dataset`}
            name={`dataset`}
            labelId="dataset-menu"
            label="Dataset"
            value={formikProps.values.dataset}
            inputProps={{ 'aria-label': 'Dataset' }}
            onChange={(item) => {
              formikProps.setFieldValue('dataset', item.target.value);
            }}>
            <MenuItem key={1} value={'Occurrence'}>
              Species Observations
            </MenuItem>
            <MenuItem key={2} value={'Boundary Centroid'}>
              Species Inventory Project
            </MenuItem>
          </Select>
        </FormControl>
        <Box mt={3}>
          <MultiAutocompleteField
            id={`species_list`}
            label={'Select Species'}
            options={speciesList}
            required={false}
            handleSearchResults={handleGetSpeciesList}
          />
        </Box>

        <Box mt={3}>
          <MultiSelectList list_name={'species_list'} />
        </Box>
      </Box>

      <Box component="fieldset" mt={5}>
        <Box
          component="legend"
          mb={1}
          p={0}
          sx={{
            fontWeight: 700
          }}>
          Refine Search Area
        </Box>

        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            mb: 3
          }}>
          Refine your search to a custom boundary by importing either KML files or Shapefiles.
        </Typography>

        <MultiSelectList list_name={'area'} />
        <UploadAreaControls />
      </Box>
    </>
  );
};

export default DatasetSearchForm;
