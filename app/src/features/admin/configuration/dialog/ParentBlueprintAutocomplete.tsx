import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ListItemText from '@mui/material/ListItemText';
import { IParentBlueprintOptions } from './ParentBlueprintOptions.interface';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';

/**
 * Render prepared parent blueprint choices using the shared Formik field.
 *
 * @param props Prepared parent options and search callbacks.
 * @returns Parent selector with error feedback.
 */
export const ParentBlueprintAutocomplete = ({ parentOptions }: { parentOptions: IParentBlueprintOptions }) => {
  const { options, searchOptions, loading, error, onSearch, onSelect } = parentOptions;
  return (
    <Box>
      <CustomAutocompleteFormik
        id="parentBlueprintId"
        name="parentBlueprintId"
        label="Parent blueprint (optional)"
        options={options}
        filterOptions={() => searchOptions}
        getOptionKey={(option) => option.value}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          const description = options.find((item) => item.value === option.value)?.description;
          return (
            <li key={key} {...optionProps}>
              <ListItemText primary={option.label} secondary={description} />
            </li>
          );
        }}
        loading={loading}
        noOptionsText={error ? 'Unable to load blueprints' : 'No blueprints found'}
        onInputChange={(_event, value, reason) => {
          if (reason === 'input' || reason === 'clear') {
            onSearch(value);
          }
        }}
        onChange={(_event, option) => onSelect(options.find((item) => item.value === option?.value) ?? null)}
      />
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
