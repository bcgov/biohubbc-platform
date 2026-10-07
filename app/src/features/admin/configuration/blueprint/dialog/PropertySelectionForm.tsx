import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { FieldArray, useFormikContext } from 'formik';
import { IPropertyAssignmentForm } from './CompositionForm.interface';
import { ICompositionOptions } from './CompositionOptions.interface';
import { AssignmentSelectionCard } from './AssignmentSelectionCard';

/**
 * Select reusable properties without changing membership until Save.
 *
 * @param props Prepared server-paginated search state.
 * @returns Search input and removable Formik selection cards.
 */
export const PropertySelectionForm = ({ options }: { options: ICompositionOptions }) => {
  const { values, errors, submitCount } = useFormikContext<IPropertyAssignmentForm>();
  return (
    <Stack spacing={2} sx={{ mt: 1, minWidth: 320 }}>
      <FieldArray
        name="properties"
        render={(arrayHelpers) => (
          <>
            <SearchAutocomplete
              options={options.matchingOptions}
              value={null}
              placeholder="Search properties"
              ariaLabel="Search properties"
              loading={options.loading}
              onInputChange={options.onSearch}
              onChange={(option) => {
                if (
                  option &&
                  !values.properties.some((property) => property.featurePropertyId === Number(option.value))
                ) {
                  arrayHelpers.push({ featurePropertyId: Number(option.value), label: option.label });
                }
                options.onSearch('');
              }}
            />
            {values.properties.map((property, index) => (
              <AssignmentSelectionCard
                key={property.featurePropertyId}
                label={property.label}
                onRemove={() => arrayHelpers.remove(index)}
              />
            ))}
          </>
        )}
      />
      {options.error && <Alert severity="error">{options.error}</Alert>}
      {submitCount > 0 && typeof errors.properties === 'string' && <Alert severity="error">{errors.properties}</Alert>}
    </Stack>
  );
};
