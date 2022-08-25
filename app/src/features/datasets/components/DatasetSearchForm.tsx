import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, IconButton, InputLabel, List } from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import { FieldArray, useFormikContext } from 'formik';
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
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
  speciesList: IMultiAutocompleteFieldOption[];
}

/**
 * Create project - Partnerships section
 *
 * @return {*}
 */
const DatasetSearchForm: React.FC<IDatasetSearchFormProps> = (props) => {
  const classes = useStyles();

  const formikProps = useFormikContext<IDatasetSearchForm>();
  // console.log('props in datasetSearchForm:', props);
  // console.log('formikprops values in datasearch form:', formikProps.values);

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
            id={`species_list`}
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

          <FieldArray
            name="area"
            render={(arrayHelpers) => (
              <>
                <UploadAreaControls onAreaUpdate={props.onAreaUpdate} />
                <Box my={1}>
                  <List dense disablePadding>
                    {!!formikProps.values.area.length &&
                      formikProps.values.area.map((areaData, index) => {
                        return (
                          <Box
                            key={`${areaData.name}-area`}
                            className={classes.listItem}
                            p={1}
                            m={0.5}
                            display="flex"
                            justifyContent={'space-between'}
                            alignItems={'center'}>
                            {areaData.name}
                            <IconButton aria-label="delete" color="inherit" onClick={() => arrayHelpers.remove(index)}>
                              <Icon path={mdiTrashCanOutline} size={1} />
                            </IconButton>
                          </Box>
                        );
                      })}
                  </List>
                </Box>
              </>
            )}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default DatasetSearchForm;
