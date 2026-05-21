import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { IAvailableUser } from 'interfaces/useTeamsApi.interface';
import yup from 'utils/YupSchema';
import { TeamMemberSelect } from './TeamMemberSelect';

/**
 * Form values for creating or editing a team.
 *
 * Stores full user objects so formik is the single source of truth —
 * IDs are extracted in the submit handler.
 */
export interface IAddTeamFormValues {
  /** Team name */
  name: string;
  /** Optional description */
  description: string;
  /** Full user objects for team members */
  system_users: IAvailableUser[];
}

/**
 * Default initial values for a new team form.
 */
export const AddTeamFormInitialValues: IAddTeamFormValues = {
  name: '',
  description: '',
  system_users: []
};

/**
 * Yup validation schema for the team form.
 */
export const AddTeamFormYupSchema = yup.object().shape({
  name: yup.string().required('Team name is required').max(250, 'Team name must be 250 characters or less'),
  description: yup.string().max(1000, 'Description must be 1000 characters or less'),
  system_users: yup.array().of(yup.object())
});

/**
 * Form component for creating or editing a team.
 *
 * Must be used within a Formik context (wrapped by EditDialog or similar).
 */
export const AddTeamForm = () => {
  const { values, errors, touched, handleChange, handleBlur, setFieldValue } = useFormikContext<IAddTeamFormValues>();

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <TextField
        name="name"
        label="Team Name"
        fullWidth
        required
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name}
      />

      <TextField
        name="description"
        label="Description"
        fullWidth
        multiline
        rows={3}
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.description && Boolean(errors.description)}
        helperText={touched.description && errors.description}
      />

      <TeamMemberSelect
        selectedUsers={values.system_users}
        onChange={(users) => setFieldValue('system_users', users)}
      />
    </Box>
  );
};
