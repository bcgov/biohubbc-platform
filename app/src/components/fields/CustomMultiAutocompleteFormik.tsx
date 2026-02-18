import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import { AutocompleteInputChangeReason, createFilterOptions } from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import { useFormikContext } from 'formik';
import { useEffect, useState } from 'react';
import { sortAutocompleteOptions } from 'utils/autocomplete';
import CustomMultiAutocomplete, {
  ICustomMultiAutocompleteProps,
  ICustomMultiAutocompleteOption
} from './CustomMultiAutocomplete';
import CustomTextField from './CustomTextField';

export interface ICustomMultiAutocompleteFormikProps extends Omit<
  ICustomMultiAutocompleteProps,
  'value' | 'onChange' | 'inputValue' | 'onInputChange' | 'renderInput'
> {
  name: string;
  label?: string;
  required?: boolean;
  filterLimit?: number;
  chipVisible?: boolean;
  placeholder?: string;
  handleSearchResults?: (input: string) => Promise<void>;
}

/**
 * Formik-connected wrapper around `CustomMultiAutocomplete`.
 *
 * @param {ICustomMultiAutocompleteFormikProps} props
 * @return {*}
 */
const CustomMultiAutocompleteFormik: React.FC<ICustomMultiAutocompleteFormikProps> = (props) => {
  const { getFieldMeta, setFieldValue, submitCount } = useFormikContext<any>();
  const {
    id,
    name,
    options: incomingOptions,
    handleSearchResults,
    label,
    required,
    filterLimit,
    chipVisible,
    placeholder = 'Begin typing to filter results...',
    ...rest
  } = props;

  const { value, touched, error } = getFieldMeta<(string | number)[]>(name);
  const showError = Boolean(error) && (Boolean(touched) || submitCount > 0);

  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<ICustomMultiAutocompleteOption[]>([...(incomingOptions ?? [])]);

  const selectedOptions: ICustomMultiAutocompleteOption[] =
    Array.isArray(value) && value.length > 0 ? options.filter((option) => value.includes(option.value)) : [];

  useEffect(() => {
    setOptions(sortAutocompleteOptions(selectedOptions, incomingOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingOptions]);

  useEffect(() => {
    if (handleSearchResults) {
      void handleSearchResults(inputValue);
    }
  }, [handleSearchResults, inputValue]);

  return (
    <CustomMultiAutocomplete
      {...rest}
      id={id}
      multiple
      autoHighlight
      disableCloseOnSelect
      options={options}
      value={selectedOptions}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
      filterOptions={createFilterOptions({ limit: filterLimit })}
      renderTags={(tagValue, getTagProps) => {
        if (!chipVisible) {
          return undefined;
        }

        return tagValue.map((option, index) => (
          <Chip label={option.label} {...getTagProps({ index })} key={option.value} />
        ));
      }}
      renderOption={(renderProps, option, { selected }) => (
        <li {...renderProps} key={option.value}>
          <Checkbox
            icon={<CheckBoxOutlineBlank fontSize="small" />}
            checkedIcon={<CheckBox fontSize="small" color="primary" />}
            style={{ marginRight: 8 }}
            checked={selected}
            value={option.value}
            color="default"
          />
          {option.label}
        </li>
      )}
      inputValue={inputValue}
      onChange={(_event, nextSelectedOptions) => {
        const nextOptions = sortAutocompleteOptions(nextSelectedOptions, options);

        setOptions(nextOptions);
        setFieldValue(
          name,
          nextSelectedOptions.map((item) => item.value)
        );
      }}
      onInputChange={(event: React.ChangeEvent<any>, newValue: string, reason: AutocompleteInputChangeReason) => {
        if (event && event.type === 'blur') {
          setInputValue('');
        } else if (reason !== 'reset') {
          setInputValue(newValue);
        }
      }}
      renderInput={(params) => (
        <CustomTextField
          {...params}
          required={required}
          label={label}
          placeholder={placeholder}
          InputLabelProps={{ shrink: true }}
          error={showError}
          helperText={showError ? error : undefined}
          onKeyDown={(event: any) => {
            if (event.key === 'Backspace') {
              event.stopPropagation();
            }
          }}
        />
      )}
    />
  );
};

export default CustomMultiAutocompleteFormik;
