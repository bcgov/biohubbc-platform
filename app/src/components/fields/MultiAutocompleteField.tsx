import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Autocomplete, { AutocompleteInputChangeReason, createFilterOptions } from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import get from 'lodash-es/get';
import { useEffect, useState } from 'react';

export interface IMultiAutocompleteFieldOption {
  value: string | number;
  label: string;
}

export interface IMultiAutocompleteField {
  id: string;
  label: string;
  options: IMultiAutocompleteFieldOption[];
  required?: boolean;
  filterLimit?: number;
  handleSearchResults?: (input: string) => Promise<void>;
}

const MultiAutocompleteField: React.FC<IMultiAutocompleteField> = (props) => {
  const { values, touched, errors, setFieldValue } = useFormikContext<IMultiAutocompleteFieldOption>();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<IMultiAutocompleteFieldOption[]>(props.options || []); // store options if provided
  const [selectedOptions, setSelectedOptions] = useState<IMultiAutocompleteFieldOption[]>([]);

  useEffect(() => {
    handleSortSelectedOption(selectedOptions, props.options);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.options]);

  useEffect(() => {
    if (props.handleSearchResults) {
      props.handleSearchResults(inputValue);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const getExistingValue = (existingValues: any[]): IMultiAutocompleteFieldOption[] => {
    if (!existingValues) {
      return [];
    }
    return options.filter((option) => existingValues.includes(option.value));
  };

  const handleSortSelectedOption = (
    selected: IMultiAutocompleteFieldOption[],
    optionsLeft: IMultiAutocompleteFieldOption[]
  ) => {
    const selectedOptionsValue = selected.map((item) => item.value);
    const remainingOptions = optionsLeft.filter((item) => !selectedOptionsValue.includes(item.value));

    setOptions([...selected, ...remainingOptions]);
  };

  const handleOnChange = (_event: React.ChangeEvent<any>, selectedOptions: IMultiAutocompleteFieldOption[]) => {
    handleSortSelectedOption(selectedOptions, options);
    setSelectedOptions(selectedOptions);
    setFieldValue(
      props.id,
      selectedOptions.map((item) => item.value)
    );
  };

  const handleGetOptionSelected = (
    option: IMultiAutocompleteFieldOption,
    value: IMultiAutocompleteFieldOption
  ): boolean => {
    if (!option?.value || !value?.value) {
      return false;
    }

    return option.value === value.value;
  };

  const handleOnInputChange = (event: React.ChangeEvent<any>, value: string, reason: AutocompleteInputChangeReason) => {
    if (event && event.type === 'blur') {
      setInputValue('');
    } else if (reason !== 'reset') {
      setInputValue(value);
    }
  };

  return (
    <Autocomplete
      multiple
      autoHighlight={true}
      value={getExistingValue(get(values, props.id))}
      id={props.id}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={handleGetOptionSelected}
      filterOptions={createFilterOptions({ limit: props.filterLimit })}
      disableCloseOnSelect
      onChange={handleOnChange}
      inputValue={inputValue}
      onInputChange={handleOnInputChange}
      renderOption={(_renderProps, option, { selected }) => {
        return (
          <li key={option.value} {..._renderProps}>
            <Checkbox
              icon={<CheckBoxOutlineBlank fontSize="small" />}
              checkedIcon={<CheckBox fontSize="small" />}
              style={{ marginRight: 8 }}
              checked={selected}
              disabled={(options && options?.indexOf(option) !== -1) || false}
              value={option.value}
              color="default"
            />
            {option.label}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          required={props.required}
          label={props.label}
          variant="outlined"
          fullWidth
          error={get(touched, props.id) && Boolean(get(errors, props.id))}
          helperText={get(touched, props.id) && get(errors, props.id)}
          placeholder={'Begin typing to filter results...'}
          InputLabelProps={{
            shrink: true
          }}
        />
      )}
    />
  );
};

export default MultiAutocompleteField;
