import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, InputLabel, List, ListItem } from '@mui/material';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import MultiAutocompleteField, { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import UploadAreaControls from 'components/map/components/UploadAreaControls';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import { FieldArray, useFormikContext } from 'formik';
import React, { useEffect } from 'react';
import yup from 'utils/YupSchema';

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
  const formikProps = useFormikContext<IDatasetSearchForm>();

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
            options={props.speciesList}
            required={false}
          />
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

        <FieldArray
          name="area"
          render={(arrayHelpers) => (
            <>
              <UploadAreaControls />
              <List dense disablePadding
                sx={{
                  '& li': {
                    display: 'flex',
                    justifyContent: 'space-between',
                    py: 0.75,
                    px: 2,
                    border: '1px solid #ccc',
                    backgroundColor: '#ebedf2',
                    fontSize: '14px'
                  },
                  '& li:first-child': {
                    mt: 2,
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                  },
                  '& li:last-child': {
                    borderBottomLeftRadius: '4px',
                    borderBottomRightRadius: '4px'
                  },
                  '& li + li': {
                    mt: "-1px"
                  }
                }}
              >
                {!!formikProps.values.area.length &&
                  formikProps.values.area.map((areaData, index) => {
                    return (
                      <ListItem key={`${areaData.name}-area`}>
                        {areaData.name}
                        <IconButton
                          aria-label="Delete boundary"
                          onClick={() => {
                            arrayHelpers.remove(index);
                          }}>
                          <Icon path={mdiTrashCanOutline} size={0.875} />
                        </IconButton>
                      </ListItem>
                    );
                  })}
              </List>
            </>
          )}
        />
      </Box>
    </>
  );
};

export default DatasetSearchForm;
