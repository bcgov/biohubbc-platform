import Stack from '@mui/material/Stack';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';

export interface IBoardTagAddFormValues {
  /** The existing tags to link to the board. */
  tagIds: string[];
}

interface IBoardTagAddFormProps {
  /** Tags matching the search. */
  tagOptions: ICustomMultiAutocompleteOption[];
  onTagSearch: (search: string) => void;
}

/**
 * Field for linking existing tags to a board: a search of the tags. Rendered inside an `EditDialog`, which owns the
 * Formik state.
 *
 * @param {IBoardTagAddFormProps} props The tag options and the tag search handler.
 * @returns {JSX.Element} The add tags form field.
 */
export const BoardTagAddForm = (props: IBoardTagAddFormProps) => {
  const { tagOptions, onTagSearch } = props;

  return (
    <Stack sx={{ mt: 1 }}>
      <CustomMultiAutocompleteFormik
        id="board-tag-add-tags"
        name="tagIds"
        label="Tags"
        required
        chipVisible
        options={tagOptions}
        onSearchInput={onTagSearch}
      />
    </Stack>
  );
};
