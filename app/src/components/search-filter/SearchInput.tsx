import { mdiClose, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, InputAdornment, TextField, TextFieldProps } from '@mui/material';
import { ChangeEvent, KeyboardEvent } from 'react';

export interface ISearchInputProps extends Omit<TextFieldProps, 'value' | 'onSubmit'> {
  placeholder?: string;
  value?: string;
  handleChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const SearchInput = ({
  placeholder,
  handleChange,
  value,
  onClear,
  onSubmit,
  inputRef,
  ...props
}: ISearchInputProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.(value?.trim() ?? '');
    }
  };

  return (
    <TextField
      fullWidth
      variant="outlined"
      size="medium"
      placeholder={placeholder}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange?.(e)}
      inputRef={inputRef}
      onKeyDown={handleKeyDown}
      {...props}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon path={mdiMagnify} size={1} style={{ opacity: 0.5 }} />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onClear} aria-label="Clear search">
              <Icon path={mdiClose} size={0.7} />
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );
};
