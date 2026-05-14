import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import InputAdornment from '@mui/material/InputAdornment';
import { ComponentProps } from 'react';
import CustomTextField from './CustomTextField';

export type SearchTextFieldProps = ComponentProps<typeof CustomTextField>;

/**
 * Search text field with a standard leading magnifier icon and compact width.
 *
 * @param {SearchTextFieldProps} props
 * @return {*}
 */
const SearchTextField = (props: SearchTextFieldProps) => {
  const { slotProps, sx, ...rest } = props;

  return (
    <CustomTextField
      {...rest}
      slotProps={{
        ...slotProps,
        input: {
          ...(typeof slotProps?.input === 'object' ? slotProps.input : {}),
          startAdornment: (
            <InputAdornment position="start">
              <Icon path={mdiMagnify} size={0.875} />
            </InputAdornment>
          )
        }
      }}
      sx={[{ width: 250 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
};

export default SearchTextField;
