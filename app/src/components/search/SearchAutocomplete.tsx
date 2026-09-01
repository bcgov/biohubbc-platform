import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { InputAdornment } from '@mui/material';
import { AutocompleteInputChangeReason, AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomAutocomplete from 'components/fields/CustomAutocomplete';
import CustomTextField from 'components/fields/CustomTextField';
import { KeyboardEvent, SyntheticEvent, useState } from 'react';
import { SearchOption } from './SearchAutocomplete.interface';

type SearchAutocompletePassthroughProps = Pick<
  MuiAutocompleteProps<SearchOption, false, false, false>,
  'disabled' | 'id' | 'loading' | 'noOptionsText' | 'onKeyDown' | 'openOnFocus' | 'size' | 'sx'
>;

interface SearchAutocompleteProps extends SearchAutocompletePassthroughProps {
  options: SearchOption[];
  value: SearchOption | null;
  label?: string;
  ariaLabel?: string;
  error?: boolean;
  freeSolo?: boolean;
  showStartAdornment?: boolean;
  placeholder?: string;
  onChange: (option: SearchOption | null) => void;
  onInputChange?: (value: string) => void;
  onFreeSoloChange?: (value: string) => void;
}

export const SearchAutocomplete = ({
  options,
  value,
  label,
  ariaLabel,
  error,
  freeSolo = false,
  showStartAdornment = true,
  placeholder = 'Search...',
  onChange,
  onInputChange,
  onFreeSoloChange,
  size = 'small',
  ...autocompleteProps
}: SearchAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');

  // Use when an option or free-solo string is committed from the autocomplete.
  const handleChange = (_: SyntheticEvent, newValue: string | SearchOption | null) => {
    setInputValue('');

    if (typeof newValue === 'string') {
      onFreeSoloChange?.(newValue);
      return;
    }

    onChange(newValue);
  };

  // Use for text input edits so callers can debounce/search while this component controls display text.
  const handleInputChange = (_: SyntheticEvent, newValue: string, reason: AutocompleteInputChangeReason) => {
    setInputValue(newValue);

    if (reason === 'input') {
      onInputChange?.(newValue);
    }
  };

  // Use Backspace as a clear shortcut only for locked, option-backed selections.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    autocompleteProps.onKeyDown?.(event);

    if (!freeSolo && event.key === 'Backspace' && value) {
      event.preventDefault();
      onChange(null);
    }
  };

  return (
    <CustomAutocomplete<string | number, boolean>
      {...autocompleteProps}
      fullWidth
      freeSolo={freeSolo}
      size={size}
      options={options}
      value={value}
      filterOptions={(x) => x}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onKeyDown={handleKeyDown}
      renderInput={(params) => (
        <CustomTextField
          {...params}
          label={label}
          placeholder={placeholder}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel,
            readOnly: !freeSolo && Boolean(value)
          }}
          error={error}
          InputProps={{
            ...params.InputProps,
            startAdornment: showStartAdornment ? (
              <InputAdornment position="start">
                <Icon path={mdiMagnify} size={1} style={{ opacity: 0.5 }} />
              </InputAdornment>
            ) : undefined
          }}
        />
      )}
    />
  );
};
