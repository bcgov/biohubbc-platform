import { InputLabel } from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
// import { IFindDataset } from 'components/map/components/SideSearchBar';
import { useFormikContext } from 'formik';
import React from 'react';
import yup from 'utils/YupSchema';

export interface IDatasetSearchForm {
  dataset: string;
  species_list: string[];
  area: IFormikAreaUpload[];
}

export const DatasetSearchFormInitialValues: IDatasetSearchForm = {
  dataset: 'Species Observations' ,
  species_list: [],
  area: []
};

export const DatasetSearchFormYupSchema = yup.object().shape({
  dataset: yup.string(),
  species_list: yup.mixed(),
  area: yup.mixed()
});

export interface IDatasetSearchFormProps {
  speciesList: IMultiAutocompleteFieldOption[];
}

/**
 * Create project - Partnerships section
 *
 * @return {*}
 */
const DatasetSearchForm: React.FC<IDatasetSearchFormProps> = (props) => {
  const formikProps = useFormikContext<IDatasetSearchForm>();

  return (
    <>
      <Box mb={3} maxWidth={'72ch'}>
        <Typography variant="body1" color="textPrimary">
          What do you want to find?
        </Typography>
      </Box>

      <Grid container spacing={4} direction="column">
        <Grid item xs={12}>
          <InputLabel id="datasetmenu_label">Dataset</InputLabel>
          <Select
            fullWidth={true}
            id={`dataset`}
            name={`dataset`}
            labelId="dataset-menu"
            label="Dataset Menu"
            value={formikProps.values.dataset}
            inputProps={{ 'aria-label': 'Dataset option' }}
            onChange={(item) => {
              formikProps.setFieldValue('dataset', item.target.value);
            }}>
            <MenuItem key={1} value={'Species Observations'}>
              Species Observations
            </MenuItem>
            <MenuItem key={2} value={'Species Inventory Project'}>
              Species Inventory Project
            </MenuItem>
          </Select>
        </Grid>
        <Grid item xs={12}>
          <MultiAutocompleteField
            id={'species_list'}
            label={'Select Species'}
            options={props.speciesList}
            required={false}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default DatasetSearchForm;
