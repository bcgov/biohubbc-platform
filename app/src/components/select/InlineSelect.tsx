import { Autocomplete, type SxProps, TextField, type Theme } from '@mui/material';

interface InlineSelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface InlineSelectProps<T extends string | number> {
  ariaLabel: string;
  value: T | '';
  options: InlineSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  disablePortal?: boolean;
  disableClearable?: boolean;
  error?: boolean;
  sx?: SxProps<Theme>;
  onChange: (value: T | '') => unknown;
}

/**
 * Compact single-select control for dense inline editing surfaces.
 *
 * Use this instead of a full-width form select when the control is embedded in
 * a token, table row, toolbar, or other constrained UI. It wraps MUI
 * `Autocomplete` so options can be searched with the keyboard, while preserving
 * select-like semantics through `value`, `options`, and `onChange`.
 *
 * The component stops click, mouse-down, and key-down propagation because it is
 * commonly rendered inside draggable/clickable parents such as expression
 * builder tokens. Without that containment, opening the menu or using arrow keys
 * can accidentally trigger parent drag/drop or popover close handlers.
 *
 * @template T String or number option value type.
 * @param {InlineSelectProps<T>} props - Current value, option list, sizing, error state, and change callback.
 * @returns {JSX.Element} Compact autocomplete-backed select.
 */
export const InlineSelect = <T extends string | number>({
  ariaLabel,
  value,
  options,
  placeholder,
  disabled,
  disablePortal = false,
  disableClearable,
  error,
  sx,
  onChange
}: InlineSelectProps<T>) => {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const endAdornmentWidth = disableClearable ? 24 : 52;
  const endAdornmentRightOffset = 4;
  const endAdornmentPaddingRight = endAdornmentWidth + endAdornmentRightOffset + 4;
  const stopAutocompletePropagation = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <Autocomplete<InlineSelectOption<T>, false, boolean, false>
      size="small"
      disablePortal={disablePortal}
      disabled={disabled}
      disableClearable={disableClearable}
      forcePopupIcon
      options={options}
      value={selectedOption}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selectedValue) => option.value === selectedValue.value}
      getOptionDisabled={(option) => !!option.disabled}
      onClick={stopAutocompletePropagation}
      onMouseDown={stopAutocompletePropagation}
      onKeyDown={stopAutocompletePropagation}
      onChange={(_, option) => onChange(option?.value ?? '')}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          aria-label={ariaLabel}
          placeholder={placeholder}
          error={error}
          onClick={stopAutocompletePropagation}
          onMouseDown={stopAutocompletePropagation}
          onKeyDown={stopAutocompletePropagation}
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel
          }}
          sx={{
            '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
              bgcolor: 'background.paper',
              fontSize: '0.875rem',
              height: 36,
              minHeight: 36,
              padding: `0 ${endAdornmentPaddingRight}px 0 6px !important`
            },
            '&& .MuiOutlinedInput-root .MuiAutocomplete-input.MuiInputBase-input': {
              height: 24,
              lineHeight: '24px',
              minWidth: 0,
              overflow: 'hidden',
              padding: '8px !important',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            },
            '&&& .MuiAutocomplete-endAdornment': {
              alignItems: 'center',
              display: 'flex',
              gap: '4px',
              justifyContent: 'flex-end',
              paddingRight: '0 !important',
              right: `${endAdornmentRightOffset}px !important`,
              width: endAdornmentWidth
            },
            '&&& .MuiAutocomplete-popupIndicator, &&& .MuiAutocomplete-clearIndicator': {
              alignItems: 'center',
              display: 'inline-flex !important',
              height: 24,
              justifyContent: 'center',
              padding: '4px',
              width: 24,
              '& .MuiSvgIcon-root': {
                fontSize: '1rem'
              }
            }
          }}
        />
      )}
    />
  );
};
