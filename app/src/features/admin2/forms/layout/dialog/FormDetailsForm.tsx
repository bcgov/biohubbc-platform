import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';

export interface IFormDetailsFormValues {
  slug: string;
  contributorId: number | null;
  name: string;
  description: string;
  isPublic: boolean;
}

interface IFormDetailsFormProps {
  /** Locks the slug and contributor once the form exists, so its URL and ownership never change. */
  isSlugLocked: boolean;
  /** Contributors that can own the form. */
  contributorOptions: ICustomAutocompleteOption<number>[];
}

/**
 * Edit a form's slug, owning contributor, name, description and whether it is public, in the shared edit dialog.
 *
 * @param {IFormDetailsFormProps} props
 * @returns {JSX.Element} Formik form detail fields.
 */
export const FormDetailsForm = ({ isSlugLocked, contributorOptions }: IFormDetailsFormProps) => {
  const { handleSubmit, values, setFieldValue } = useFormikContext<IFormDetailsFormValues>();

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3} pt={1}>
        <CustomTextFieldFormik name="name" label="Name" fullWidth required />
        <CustomTextFieldFormik
          name="slug"
          label="Slug"
          fullWidth
          required
          disabled={isSlugLocked}
          onChange={(event) => setFieldValue('slug', event.target.value.toLowerCase())}
        />
        <CustomAutocompleteFormik<number>
          id="contributorId"
          name="contributorId"
          label="Contributor"
          required
          disabled={isSlugLocked}
          options={contributorOptions}
          placeholder="Select a contributor"
        />
        <CustomTextFieldFormik name="description" label="Description" fullWidth multiline rows={3} />
        <FormControlLabel
          label="Public"
          control={
            <Switch checked={values.isPublic} onChange={(event) => setFieldValue('isPublic', event.target.checked)} />
          }
        />
      </Stack>
    </form>
  );
};
