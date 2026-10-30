import Stack from '@mui/material/Stack';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';
import { useFormikContext } from 'formik';

export interface IFormTeamsFormValues {
  teamIds: string[];
}

interface IFormTeamsFormProps {
  /** Team options: the current search results and the teams already linked. */
  teamOptions: ICustomMultiAutocompleteOption[];
  /** Searches teams by name. */
  onTeamSearch: (search: string) => void;
}

/**
 * Pick the teams whose members may access a form that is not public, in the shared edit dialog.
 *
 * @param {IFormTeamsFormProps} props
 * @returns {JSX.Element} Formik team picker.
 */
export const FormTeamsForm = ({ teamOptions, onTeamSearch }: IFormTeamsFormProps) => {
  const { handleSubmit } = useFormikContext<IFormTeamsFormValues>();

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3} pt={1}>
        <CustomMultiAutocompleteFormik
          id="teamIds"
          name="teamIds"
          label="Teams"
          options={teamOptions}
          chipVisible
          onSearchInput={onTeamSearch}
        />
      </Stack>
    </form>
  );
};
