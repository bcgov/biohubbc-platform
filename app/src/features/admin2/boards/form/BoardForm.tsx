import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { TagAutocomplete } from 'components/tags/TagAutocomplete';
import { useFormikContext } from 'formik';
import { ITagSummary } from 'interfaces/useTagsApi.interface';

export interface IBoardFormValues {
  name: string;
  description: string | null;
  /** The board's tags: tickets with any of them appear on the board. */
  tags: ITagSummary[];
}

/**
 * Board fields: name, description and the tags whose tickets the board shows. Rendered inside an
 * `EditDialog`, which owns the Formik state.
 *
 * @returns {JSX.Element} The board form fields.
 */
export const BoardForm = () => {
  const { values, setFieldValue } = useFormikContext<IBoardFormValues>();

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Name" name="name" required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
      <TagAutocomplete
        id="board-tags"
        label="Board tags"
        placeholder="Tickets with any of these tags appear on the board"
        value={values.tags}
        onChange={(tags) => setFieldValue('tags', tags)}
      />
    </Stack>
  );
};
