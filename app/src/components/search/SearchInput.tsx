import { mdiClose, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, InputAdornment, TextField, TextFieldProps } from '@mui/material';
import { KeyboardEvent } from 'react';

export interface ISearchInputProps extends Omit<TextFieldProps, 'value' | 'onSubmit'> {
  placeholder?: string;
  value?: string;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Shared search input with enter-to-submit and clear behavior.
 *
 * @param {ISearchInputProps} props
 * @returns {JSX.Element}
 */
export const SearchInput = ({ placeholder, value, onClear, onSubmit, inputRef, ...props }: ISearchInputProps) => {
  // Submit the current query value when the Enter key is pressed.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.(value?.trim() ?? '');
    }
  };

  // Clear the current query and emit an empty submit.
  const handleClear = () => {
    onClear?.();
    onSubmit?.('');
  };

  return (
    <TextField
      fullWidth
      variant="outlined"
      size="medium"
      placeholder={placeholder}
      value={value}
      inputRef={inputRef}
      onKeyDown={handleKeyDown}
      {...props}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon path={mdiMagnify} size={1} />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={handleClear} aria-label="Clear search">
              <Icon path={mdiClose} size={0.7} />
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );
};
