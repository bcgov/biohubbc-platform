import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { InputAdornment } from '@mui/material';
import { AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomAutocomplete from 'components/fields/CustomAutocomplete';
import CustomTextField from 'components/fields/CustomTextField';
import { useState } from 'react';
import { SearchOption } from './SearchAutocomplete.interface';

interface SearchAutocompleteProps extends Omit<
  MuiAutocompleteProps<SearchOption, false, false, false>,
  'options' | 'value' | 'onChange' | 'onInputChange' | 'renderInput'
> {
  options: SearchOption[];
  value: SearchOption | null;
  label?: string;
  showStartAdornment?: boolean;
  placeholder?: string;
  onChange: (option: SearchOption | null) => void;
  onInputChange?: (value: string) => void;
}

export const SearchAutocomplete = ({
  options,
  value,
  label,
  showStartAdornment = true,
  placeholder = 'Search...',
  onChange,
  onInputChange,
  size = 'small',
  ...autocompleteProps
}: SearchAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');

  return (
    <CustomAutocomplete<string | number>
      {...autocompleteProps}
      fullWidth
      size={size}
      options={options}
      value={value}
      filterOptions={(x) => x}
      getOptionLabel={(option) => option.label}
      onChange={(_, newValue) => {
        setInputValue('');
        onChange(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(_, newValue, reason) => {
        if (reason === 'input') {
          setInputValue(newValue);
          onInputChange?.(newValue);
        } else {
          setInputValue(newValue);
        }
      }}
      onKeyDown={(event) => {
        autocompleteProps.onKeyDown?.(event);

        if (event.key === 'Backspace' && value) {
          event.preventDefault();
          onChange(null);
        }
      }}
      renderInput={(params) => (
        <CustomTextField
          {...params}
          label={label}
          placeholder={placeholder}
          inputProps={{
            ...params.inputProps,
            readOnly: Boolean(value)
          }}
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
