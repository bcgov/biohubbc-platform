import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { TagAutocomplete } from 'components/tags/TagAutocomplete';
import { TAG_DEFAULT_COLOR } from 'constants/tag';
import { useFormikContext } from 'formik';
import { IBoardTag } from 'interfaces/useBoardsApi.interface';

export interface ISwimlaneFormValues {
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`, or null for the neutral lane color. */
  color: string | null;
  isVisible: boolean;
  /** The lane's tags, from its board's tags: board tickets with any of them appear in the lane. */
  tags: IBoardTag[];
}

interface ISwimlaneFormProps {
  /** The board's tags, the only tags a lane can hold. */
  boardTags: IBoardTag[];
}

/**
 * Swimlane fields: name, description, an optional color, visibility and the tags whose tickets the lane holds.
 * Rendered inside an `EditDialog`, which owns the Formik state.
 *
 * @param {ISwimlaneFormProps} props The board's tags, offered as the lane's tags.
 * @returns {JSX.Element} The swimlane form fields.
 */
export const SwimlaneForm = (props: ISwimlaneFormProps) => {
  const { boardTags } = props;
  const { values, setFieldValue } = useFormikContext<ISwimlaneFormValues>();
  const hasColor = values.color !== null;

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Name" name="name" required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 250 } }}
      />
      <Stack direction="row" alignItems="center" gap={2}>
        <FormControlLabel
          label="Lane color"
          control={
            <Checkbox
              checked={hasColor}
              onChange={(event) => setFieldValue('color', event.target.checked ? TAG_DEFAULT_COLOR : null)}
            />
          }
        />
        {hasColor ? <CustomTextFieldFormik label="Color" name="color" type="color" sx={{ width: 120 }} /> : null}
      </Stack>
      <FormControlLabel
        label="Visible on the board"
        control={
          <Switch checked={values.isVisible} onChange={(event) => setFieldValue('isVisible', event.target.checked)} />
        }
      />
      <TagAutocomplete
        id="swimlane-tags"
        label="Lane tags"
        placeholder="Board tickets with any of these tags appear in the lane"
        options={boardTags}
        value={values.tags}
        onChange={(tags) => setFieldValue('tags', tags)}
      />
    </Stack>
  );
};
