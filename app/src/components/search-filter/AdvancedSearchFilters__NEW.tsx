import Box from '@material-ui/core/Box';
// import Divider from '@material-ui/core/Divider';
// import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
/*
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField'
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
*/
import Typography from '@material-ui/core/Typography';
// import AutocompleteFreeSoloField from 'components/fields/AutocompleteFreeSoloField';
import CustomTextField from 'components/fields/CustomTextField';
import { IMultiAutocompleteFieldOption } from 'components/fields/MultiAutocompleteField';
import MultiAutocompleteFieldVariableSize from 'components/fields/MultiAutocompleteFieldVariableSize__NEW';
import { useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import { debounce } from 'lodash-es';
import React, { useCallback } from 'react';
import { IAdvancedSearchFilters } from './AdvancedSearch';

/**
 * Project - Advanced filters
 *
 * @return {*}
 */
const ProjectAdvancedFilters: React.FC = (props) => {
  const formikProps = useFormikContext<IAdvancedSearchFilters>();
  const biohubApi = useApi();

  // const { handleChange, values } = formikProps;
  console.log('formikProps:', formikProps);

  const convertOptions = (value: any): IMultiAutocompleteFieldOption[] =>
    value.map((item: any) => {
      return { value: parseInt(item.id), label: item.label };
    });

  const handleGetInitList = async (initialvalues: number[]) => {
    const response = await biohubApi.taxonomy.getSpeciesFromIds(initialvalues);
    return convertOptions(response.searchResponse);
  };

  const handleSearch = useCallback(
    debounce(
      async (
        inputValue: string,
        existingValues: (string | number)[],
        callback: (searchedValues: IMultiAutocompleteFieldOption[]) => void
      ) => {
        const response = await biohubApi.taxonomy.searchSpecies(inputValue.toLowerCase());
        const newOptions = convertOptions(response.searchResponse).filter(
          (item) => !existingValues.includes(item.value)
        );
        callback(newOptions);
      },
      500
    ),
    []
  );

  return (
    <Box data-testid="advancedSearchFilters">
      <Grid container spacing={3} justify="flex-start">
        <Grid item xs={12} md={3}>
          <Typography variant="subtitle1" component="h3">
            <strong>Dataset Details</strong>
          </Typography>
        </Grid>
        <Grid item xs={12} md={9}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <CustomTextField name="project_name" label="Project Name" />
            </Grid>

            <Grid item xs={12}>
              <MultiAutocompleteFieldVariableSize
                id="species"
                label="Species"
                required={false}
                type="api-search"
                getInitList={handleGetInitList}
                search={handleSearch}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectAdvancedFilters;
