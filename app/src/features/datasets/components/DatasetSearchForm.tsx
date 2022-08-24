import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, IconButton, InputLabel } from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import { FormikContextType, useFormikContext } from 'formik';
import React from 'react';
import yup from 'utils/YupSchema';

const useStyles = makeStyles(() => ({
  listItem: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dadada',
    borderRadius: '4px',
    background: '#f7f8fa'
  }
}));
export interface IDatasetSearchForm {
  dataset: string;
  species_list: string[];
  area: IFormikAreaUpload[];
}

export const DatasetSearchFormInitialValues: IDatasetSearchForm = {
  dataset: 'Species Observations',
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
        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
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
        <Grid item xs={12}>
          <Box mb={3} maxWidth={'72ch'}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              Define area of interest
            </Typography>
            <Typography variant="body1">
              Define your area of interest by selecting an option below OR use the drawing tools on the map.
            </Typography>
          </Box>
          <Button color="primary" data-testid="select-region" variant="outlined" sx={{ marginRight: 1 }}>
            Select Region
          </Button>
          <UploadAreaControls />
        </Grid>
        <Grid item xs={12}>
          {!!formikProps.values.area.length &&
            formikProps.values.area.map((areaData) => {
              return (
                <SelectedVarListItem
                  key={areaData.name}
                  name={areaData.name}
                  formikName={'area'}
                  formikProp={formikProps}
                />
              );
            })}
        </Grid>
      </Grid>
    </>
  );
};

export default DatasetSearchForm;

export interface SelectedVarListItemProps {
  name: string;
  formikName: string;
  formikProp: FormikContextType<IDatasetSearchForm>;
}

export const SelectedVarListItem: React.FC<SelectedVarListItemProps> = (props) => {
  const classes = useStyles();
  const { name, formikName, formikProp } = props;

  const removeVar = () => {
    const currentVarIndex = formikProp.values.area.findIndex((x) => x.name === name);
    console.log('name', name);
    console.log('formikName', formikName);
    console.log('formikProp', formikProp.values);
    console.log('currentVarIndex', currentVarIndex);

    const newFormikVal = formikProp.values.area.splice(currentVarIndex, 1);
    formikProp.setFieldValue(formikName, newFormikVal);
    console.log('AAAAAAAAAAAAAAAAAAAAAformikProp', formikProp.values.area);
  };

  return (
    <Box
      key={`${name}-${formikName}`}
      className={classes.listItem}
      p={1}
      m={0.5}
      display="flex"
      justifyContent={'space-between'}
      alignItems={'center'}>
      {name}
      <IconButton aria-label="delete" color="inherit" onClick={removeVar}>
        <Icon path={mdiTrashCanOutline} size={1} />
      </IconButton>
    </Box>
  );
};
