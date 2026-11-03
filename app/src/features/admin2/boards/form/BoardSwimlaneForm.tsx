import { mdiPound } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { HEX_COLOR_DIGITS_PATTERN } from 'constants/tag';
import { getTagColor, getTagColorDigits } from 'features/admin2/tags/form/tag-color';
import { useFormikContext } from 'formik';

export interface IBoardSwimlaneFormValues {
  name: string;
  description: string | null;
  /** The color's six hex digits, without the leading `#`, or empty for no color. */
  color: string;
  /** Left-to-right position as typed, higher further right; empty to create the lane last. */
  sortOrder: string;
}

/**
 * Board swimlane fields: name, description, optional color, and sort order, where higher sorts further right. Rendered
 * inside an `EditDialog`, which owns the Formik state.
 *
 * @returns {JSX.Element} The swimlane form fields.
 */
export const BoardSwimlaneForm = () => {
  const { values, setFieldValue } = useFormikContext<IBoardSwimlaneFormValues>();
  const swatchColor = HEX_COLOR_DIGITS_PATTERN.test(values.color) ? getTagColor(values.color) : 'transparent';

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
      <CustomTextFieldFormik
        label="Sort order"
        name="sortOrder"
        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 9 } }}
      />
      <CustomTextFieldFormik
        label="Color"
        name="color"
        placeholder="1A5A96"
        onChange={(event) => setFieldValue('color', getTagColorDigits(event.target.value))}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon path={mdiPound} size={0.7} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: 0.5,
                    border: 1,
                    borderColor: 'divider',
                    backgroundColor: swatchColor
                  }}
                />
              </InputAdornment>
            )
          }
        }}
      />
    </Stack>
  );
};
