import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, TextField, TextFieldProps } from '@mui/material';
import { ChangeEvent } from 'react';

export interface ISearchSlotProps extends Omit<TextFieldProps, 'value'> {
  placeholderText?: string;
  handleChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  value?: string;
}

export const SearchInput = ({ placeholderText, handleChange, value, ...props }: ISearchSlotProps) => {
  return (
    <TextField
      fullWidth
      variant="outlined"
      placeholder={placeholderText}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange?.(e)}
      sx={{
        height: 56,
        borderRadius: '5px',
        backgroundColor: '#f7f8fa',
        '& .MuiOutlinedInput-root': {
          height: '100%'
        },
        '&.Mui-focused': { outline: '2px solid #3B99FC' },
        ...props.sx
      }}
      slotProps={{
        ...props.slotProps,
        input: {
          ...props.slotProps?.input,
          startAdornment: (
            <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.5, pl: 1 }}>
              <Icon path={mdiMagnify} size={1} />
            </Box>
          )
        }
      }}
      {...props}
    />
  );
};
