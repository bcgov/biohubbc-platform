import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import { Chip } from '@mui/material';
import Autocomplete, { AutocompleteInputChangeReason, createFilterOptions } from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import get from 'lodash-es/get';
import { useState } from 'react';

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
  chipVisible?: boolean;
}

const MultiAutocompleteField: React.FC<IMultiAutocompleteField> = (props) => {
  const { values, touched, errors, setFieldValue } = useFormikContext<IMultiAutocompleteFieldOption>();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState(props.options || []); // store options if provided

  const getExistingValue = (existingValues: any[]): IMultiAutocompleteFieldOption[] => {
    if (!existingValues) {
      return [];
    }
    return options.filter((option) => existingValues.includes(option));
  };

  const handleOnChange = (_event: React.ChangeEvent<any>, selectedOptions: IMultiAutocompleteFieldOption[]) => {
    const selectedOptionsValue = selectedOptions.map((item) => item);
    const remainingOptions = options.filter((item) => !selectedOptionsValue.includes(item));

    setOptions([...selectedOptions, ...remainingOptions]);

    setFieldValue(
      props.id,
      selectedOptions.map((item) => item)
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

  const defaultChipDisplay = (option: any, renderProps: any, checkedStatus: any) => {
    return (
      <li key={option.value} {...renderProps}>
        <Checkbox
          icon={<CheckBoxOutlineBlank fontSize="small" />}
          checkedIcon={<CheckBox fontSize="small" />}
          style={{ marginRight: 8 }}
          checked={checkedStatus}
          disabled={(options && options?.indexOf(option) !== -1) || false}
          value={option.value}
          color="default"
        />
        {option.label}
      </li>
    );
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
      renderTags={(tagValue, getTagProps) => {
        if (props.chipVisible) {
          return tagValue.map((option, index) => <Chip label={option.label} {...getTagProps({ index })} />);
        }
      }}
      renderOption={(_renderProps, option, { selected }) => defaultChipDisplay(option, _renderProps, selected)}
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
