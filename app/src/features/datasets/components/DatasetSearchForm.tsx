import { InputLabel } from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import React from 'react';
import yup from 'utils/YupSchema';

export interface IDatasetSearchForm {
  searchCriteria: {
    dataset: string;
    species_list: string[];
  };
}

export const DatasetSearchFormInitialValues: IDatasetSearchForm = {
  searchCriteria: {
    dataset: '',
    species_list: []
  }
};

export const DatasetSearchFormYupSchema = yup.object().shape({
  searchCriteria: yup.object().shape({
    dataset: yup.string(),
    species_list: yup.mixed()
  })
});

export interface IDatasetSearchFormProps {
  searchCriteria: {
    dataset: string[];
    species_list: IMultiAutocompleteFieldOption[];
  };
}

/**
 * Create project - Partnerships section
 *
 * @return {*}
 */
const DatasetSearchForm: React.FC<IDatasetSearchFormProps> = (props) => {


  return (
    <>
      <Box mb={3} maxWidth={'72ch'}>
        <Typography variant="body1" color="textPrimary">
          What do you want to find?
        </Typography>
      </Box>

      <Grid container spacing={3} direction="column">
        <Grid item xs={12}>
          <InputLabel id="permit_type">Permit Type</InputLabel>
          <Select
            id={`datasetmenu`}
            name={`datasetmenu`}
            labelId="dataset-menu"
            label="Dataset Menu"
            value={props.searchCriteria.dataset}
            inputProps={{ 'aria-label': 'Dataset option' }}>
            <MenuItem key={1} value={'Species Inventory Project'}>
              Species Inventory project
            </MenuItem>
            <MenuItem key={2} value={'Species Observations'}>
              Species Observations
            </MenuItem>
          </Select>
        </Grid>
        <Grid item xs={12}>
          <MultiAutocompleteField
            id={'dataset.select_species'}
            label={'Select Species'}
            options={props.searchCriteria.species_list}
            required={false}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default DatasetSearchForm;
