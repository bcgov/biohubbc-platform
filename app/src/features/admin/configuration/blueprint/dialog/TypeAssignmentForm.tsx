import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { FieldArray, useFormikContext } from 'formik';
import { useState } from 'react';
import { AssignmentSelectionCard } from './AssignmentSelectionCard';
import { ITypeAssignmentForm } from './CompositionForm.interface';
import { ICompositionOptions } from './CompositionOptions.interface';

/**
 * Select reusable feature types and keep pending assignments in Formik.
 *
 * @param props Prepared top-ten feature-type search options.
 * @returns Empty autocomplete and removable selection cards.
 */
export const TypeAssignmentForm = ({ featureTypeOptions }: { featureTypeOptions: ICompositionOptions }) => {
  const { values } = useFormikContext<ITypeAssignmentForm>();
  const [inputValue, setInputValue] = useState('');
  return (
    <Stack spacing={1} sx={{ mt: 1, minWidth: 320 }}>
      <FieldArray
        name="featureTypes"
        render={(arrayHelpers) => (
          <>
            <CustomAutocompleteFormik
              id="featureTypes"
              name="featureTypes"
              placeholder="Search feature types"
              value={null}
              inputValue={inputValue}
              options={featureTypeOptions.matchingOptions}
              filterOptions={(options) => options}
              loading={featureTypeOptions.loading}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setInputValue(value);
                  featureTypeOptions.onSearch(value);
                }
              }}
              onChange={(_event, option) => {
                if (option && !values.featureTypes.some((featureType) => featureType.featureTypeId === option.value)) {
                  arrayHelpers.push({ featureTypeId: option.value, label: option.label });
                }
                setInputValue('');
                featureTypeOptions.onSearch('');
              }}
            />
            {values.featureTypes.map((featureType, index) => (
              <AssignmentSelectionCard
                key={featureType.featureTypeId}
                label={featureType.label}
                onRemove={() => arrayHelpers.remove(index)}
              />
            ))}
          </>
        )}
      />
      {featureTypeOptions.error && <Alert severity="error">{featureTypeOptions.error}</Alert>}
    </Stack>
  );
};
