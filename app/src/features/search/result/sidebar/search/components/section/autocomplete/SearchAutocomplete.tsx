import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { InputAdornment } from '@mui/material';
import { AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomAutocomplete from 'components/fields/CustomAutocomplete';
import CustomTextField from 'components/fields/CustomTextField';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
import { useState } from 'react';

// Omit the props we handle ourselves
interface SearchAutocompleteProps extends Omit<
  MuiAutocompleteProps<SidebarOption, false, false, false>,
  'options' | 'value' | 'onChange' | 'onInputChange' | 'renderInput'
> {
  options: SidebarOption[];
  value: SidebarOption | null;
  label?: string;
  showStartAdornment?: boolean;
  placeholder?: string;
  onChange: (option: SidebarOption | null) => void;
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
        // Only call onInputChange if the change is from user typing, not from selection/clear
        if (reason === 'input') {
          setInputValue(newValue);
          onInputChange?.(newValue);
        } else {
          // For other reasons (selection, clear), just update the input without calling the callback
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
