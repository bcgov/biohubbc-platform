import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, SxProps, Theme } from '@mui/material';
import { InlineAutocomplete } from 'components/select/InlineAutocomplete';
import { ExpressionBuilderProperty } from 'components/expression-builder/ExpressionBuilder.interface';
import { useEffect, useState } from 'react';

interface ExpressionBuilderPropertySearchProps {
  /** Parent-cached properties to offer before remote results arrive. */
  properties: ExpressionBuilderProperty[];
  /** Accessible label for the autocomplete input. */
  ariaLabel?: string;
  /** Currently selected property, when the control is parent-controlled. */
  value?: ExpressionBuilderProperty | null;
  /** Placeholder text shown while no property is selected. */
  placeholder: string;
  /** Whether to show the leading search icon. */
  showSearchIcon?: boolean;
  /** Marks the input invalid for validation feedback. */
  error?: boolean;
  /** Inline style overrides for compact token layouts. */
  sx?: SxProps<Theme>;
  /** Reports the property selected by the user. */
  onSelectProperty: (property: ExpressionBuilderProperty) => unknown;
  /** Requests a refresh of the parent-owned property options. */
  onSearchInputChange: (keyword: string) => unknown;
}

/**
 * Property autocomplete used by expression predicate tokens.
 *
 * Use this component when a predicate needs to select a searchable feature
 * property. The parent owns and refreshes the shared option list so every
 * predicate token sees a consistent set of property options. The selected
 * property is controlled through `value`; the search input text is managed
 * internally.
 *
 * @param {ExpressionBuilderPropertySearchProps} props - Property cache, selected value, display options, and callbacks.
 * @returns {JSX.Element} Inline property autocomplete control.
 */
export const ExpressionBuilderPropertySearch = ({
  properties,
  ariaLabel,
  value,
  placeholder,
  showSearchIcon = true,
  error,
  sx,
  onSelectProperty,
  onSearchInputChange
}: ExpressionBuilderPropertySearchProps) => {
  const [inputValue, setInputValue] = useState('');
  const hasControlledValue = value !== undefined;

  useEffect(() => {
    if (!hasControlledValue) {
      return;
    }

    setInputValue(value?.label ?? '');
  }, [hasControlledValue, value]);

  return (
    <InlineAutocomplete
      ariaLabel={ariaLabel}
      size="small"
      variant="outlined"
      error={error}
      selectedValue={value}
      sx={sx}
      options={properties}
      inputValue={inputValue}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selectedValue) =>
        option.feature_property_id === selectedValue.feature_property_id &&
        option.feature_type_property_id === selectedValue.feature_type_property_id
      }
      onInputChange={(_, nextInputValue, reason) => {
        if (reason !== 'input') {
          setInputValue(nextInputValue);
          return;
        }

        setInputValue(nextInputValue);
        onSearchInputChange(nextInputValue);
      }}
      onChange={(_, property) => {
        if (!property) {
          return;
        }

        onSelectProperty(property);
        setInputValue(hasControlledValue ? property.label : '');
      }}
      placeholder={placeholder}
      startAdornment={
        showSearchIcon ? (
          <InputAdornment position="start" sx={{ color: 'text.secondary', ml: 1 }}>
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ) : undefined
      }
    />
  );
};
