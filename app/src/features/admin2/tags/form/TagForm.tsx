import { mdiPound } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { HEX_COLOR_DIGITS_PATTERN } from 'constants/tag';
import { useFormikContext } from 'formik';
import { getTagColor, getTagColorDigits } from './tag-color';

export interface ITagFormValues {
  name: string;
  description: string | null;
  /** The color's six hex digits, without the leading `#`, such as `1A5A96`. */
  color: string;
}

/**
 * Tag fields: name, description and color. Rendered inside an `EditDialog`, which owns the Formik state.
 *
 * The color is a hex code without the `#`: a pound icon starts the field and a swatch of the color ends it. Any `#`
 * typed or pasted is removed, so a color copied as `#1A5A96` pastes as `1A5A96`.
 *
 * @returns {JSX.Element} The tag form fields.
 */
export const TagForm = () => {
  const { values, setFieldValue } = useFormikContext<ITagFormValues>();
  const swatchColor = HEX_COLOR_DIGITS_PATTERN.test(values.color) ? getTagColor(values.color) : 'transparent';

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Name" name="name" required slotProps={{ htmlInput: { maxLength: 50 } }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 250 } }}
      />
      <CustomTextFieldFormik
        label="Color"
        name="color"
        required
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
                  data-testid="tag-color-swatch"
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
