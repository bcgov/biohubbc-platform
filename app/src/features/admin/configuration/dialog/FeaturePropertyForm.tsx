import Box from '@mui/material/Box';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';
import { IFeaturePropertyFormValues } from './ConfigurationForm.interface';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { IFeaturePropertyType } from 'interfaces/useFeaturePropertiesApi.interface';

/**
 * Edit FeatureProperty metadata using the shared administrative dialog's Formik context.
 *
 * @param props Property type choices and edit state.
 * @returns Metadata form fields.
 */
export const FeaturePropertyForm = ({
  propertyTypes,
  editing
}: {
  propertyTypes: IFeaturePropertyType[];
  editing: boolean;
}) => {
  const { values, handleChange, handleSubmit } = useFormikContext<IFeaturePropertyFormValues>();
  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={3} pt={1}>
        {!editing && <CustomTextFieldFormik name="name" label="Name" type="text" fullWidth required />}
        <CustomTextFieldFormik name="display_name" label="Display name" type="text" fullWidth required />
        <CustomTextFieldFormik name="description" label="Description" type="text" fullWidth multiline rows={3} />
        {!editing && (
          <Box>
            <CustomAutocompleteFormik
              id="feature_property_type_id"
              name="feature_property_type_id"
              label="Property type"
              placeholder="Select a property type"
              required
              options={propertyTypes.map((type) => ({ value: type.feature_property_type_id, label: type.name }))}
            />
          </Box>
        )}
        {!editing && (
          <FormControlLabel
            label="Calculated"
            control={<Checkbox name="calculated_value" checked={values.calculated_value} onChange={handleChange} />}
          />
        )}
      </Box>
    </form>
  );
};
