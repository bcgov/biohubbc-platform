import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, IconButton, InputLabel, List } from '@mui/material';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import { FieldArray, useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import React, { useEffect, useState } from 'react';
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
  speciesList: IMultiAutocompleteFieldOption[];
}

/**
 * Create project - Partnerships section
 *
 * @return {*}
 */
const DatasetSearchForm: React.FC<IDatasetSearchFormProps> = (props) => {
  const api = useApi();
  const classes = useStyles();

  const formikProps = useFormikContext<IDatasetSearchForm>();

  const [speciesList, setSpeciesList] = useState<IMultiAutocompleteFieldOption[]>([]);

  const convertOptions = (value: any): IMultiAutocompleteFieldOption[] =>
    value.map((item: any) => {
      return { value: parseInt(item.id), label: item.label };
    });

  const handleGetInitList = async (value: string) => {
    const response = await api.taxonomy.searchSpecies(value);

    setSpeciesList(convertOptions(response.searchResponse));
  };

  useEffect(() => {
    handleGetInitList('');
    //console.log('speciesList', speciesList);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    props.onAreaUpdate(formikProps.values.area);
    //console.log('speciesList', speciesList);

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
          <MultiAutocompleteField id={`species_list`} label={'Select Species'} options={speciesList} required={false} />
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
          Define area of interest
        </Box>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            mb: 3
          }}>
          Define your area of interest by selecting an option below OR use the drawing tools on the map.
        </Typography>

        <Box>
          <Button
            color="primary"
            data-testid="select-region"
            variant="outlined"
            sx={{
              mr: 1
            }}>
            Select Region
          </Button>

          <FieldArray
            name="area"
            render={(arrayHelpers) => (
              <>
                <UploadAreaControls />
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
                            <IconButton
                              aria-label="delete"
                              color="inherit"
                              onClick={() => {
                                arrayHelpers.remove(index);
                              }}>
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
        </Box>
      </Box>
    </>
  );
};

export default DatasetSearchForm;
