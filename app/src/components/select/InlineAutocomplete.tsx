import { Autocomplete, AutocompleteProps, SxProps, TextField, TextFieldProps, Theme } from '@mui/material';
import { type ReactNode } from 'react';

type InlineAutocompleteProps<T> = Omit<
  AutocompleteProps<T, false, false, false>,
  'renderInput' | 'value' | 'multiple' | 'disableClearable' | 'freeSolo'
> & {
  ariaLabel?: string;
  placeholder?: string;
  selectedValue?: T | null;
  startAdornment?: ReactNode;
  textFieldSx?: SxProps<Theme>;
  error?: boolean;
  variant?: TextFieldProps['variant'];
};

/**
 * Lightweight autocomplete for inline controls that need caller-owned options.
 *
 * Use this component when a feature-specific control needs MUI autocomplete
 * behavior but wants to own the input rendering shape, selected value, and
 * optional adornments. It intentionally keeps single-select, non-free-solo
 * semantics so consumers can treat selected options as structured objects
 * rather than arbitrary user text.
 *
 * `selectedValue` controls the chosen option. The standard variant disables the
 * underline by default to fit token-style layouts; callers can pass `variant`
 * and `textFieldSx` when they need an outlined field or tighter sizing.
 *
 * @template T Autocomplete option object type.
 * @param {InlineAutocompleteProps<T>} props - Autocomplete props plus inline text-field configuration.
 * @returns {JSX.Element} Inline autocomplete field.
 */
export const InlineAutocomplete = <T,>({
  ariaLabel,
  placeholder,
  selectedValue,
  startAdornment,
  textFieldSx,
  error,
  disablePortal = false,
  variant = 'standard',
  ...props
}: InlineAutocompleteProps<T>) => {
  return (
    <Autocomplete<T, false, false, false>
      disablePortal={disablePortal}
      {...props}
      value={selectedValue ?? null}
      renderInput={(params) => {
        const textFieldInputProps: typeof params.InputProps & { disableUnderline?: boolean } = {
          ...params.InputProps,
          startAdornment: (
            <>
              {startAdornment}
              {params.InputProps.startAdornment}
            </>
          )
        };

        if (variant === 'standard') {
          textFieldInputProps.disableUnderline = true;
        }

        return (
          <TextField
            {...params}
            aria-label={ariaLabel}
            variant={variant}
            placeholder={placeholder}
            error={error}
            InputProps={textFieldInputProps}
            sx={{
              '& .MuiInputBase-root': {
                p: 0
              },
              '& .MuiInputBase-input': {
                px: 0.5,
                py: 0.75
              },
              ...textFieldSx
            }}
            inputProps={{
              ...params.inputProps,
              'aria-label': ariaLabel ?? params.inputProps['aria-label']
            }}
          />
        );
      }}
    />
  );
};
