import CheckBox from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import get from 'lodash-es/get';
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
}

const MultiAutocompleteField: React.FC<IMultiAutocompleteField> = (props) => {
  console.log('props in the multiautocomplete field: ', props);

  const { values, touched, errors, setFieldValue } = useFormikContext<IMultiAutocompleteFieldOption>();
  // const [inputValue, setInputValue] = useState('');
  // const [options, setOptions] = useState(props.options || []); // store options if provided

  const getExistingValue = (existingValues: any[]): IMultiAutocompleteFieldOption[] => {
    if (!existingValues) {
      return [];
    }
    return props.options.filter((option) => existingValues.includes(option.value));
  };

  // const handleOnChange = (_event: React.ChangeEvent<any>, selectedOptions: IMultiAutocompleteFieldOption[]) => {
  //   const selectedOptionsValue = selectedOptions.map((item) => item.value);
  //   const remainingOptions = options.filter((item) => !selectedOptionsValue.includes(item.value));

  //   setOptions([...selectedOptions, ...remainingOptions]);

  //   setFieldValue(
  //     props.id,
  //     selectedOptions.map((item) => item.value)
  //   );
  // };

  const handleGetOptionSelected = (
    option: IMultiAutocompleteFieldOption,
    value: IMultiAutocompleteFieldOption
  ): boolean => {
    if (!option?.value || !value?.value) {
      return false;
    }

    return option.value === value.value;
  };

  // const handleOnInputChange = (event: React.ChangeEvent<any>, value: string, reason: AutocompleteInputChangeReason) => {
  //   if (event && event.type === 'blur') {
  //     setInputValue('');
  //   } else if (reason !== 'reset') {
  //     setInputValue(value);
  //   }
  // };

  console.log('values in multiautocompletefield:', values);
  console.log('props.id:', props.id);

  console.log('what is in get(values, props.id) ', get(values, `species_list`));

  console.log('values[props.id]', values[props.id]);

  return (
    <Autocomplete
      multiple
      autoHighlight={true}
      value={getExistingValue(values[props.id])}
      id={props.id}
      options={props.options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={handleGetOptionSelected}
      filterOptions={createFilterOptions({ limit: props.filterLimit })}
      disableCloseOnSelect
      onChange={(event, option) => {
        setFieldValue(
          props.id,
          option.map((item) => item.value)
        );
      }}
      // inputValue={inputValue}
      // onInputChange={handleOnInputChange}
      renderOption={(_props, option, { selected }) => {
        const disabled: any = props.options && props.options?.indexOf(option) !== -1;
        return (
          <>
            <Checkbox
              icon={<CheckBoxOutlineBlank fontSize="small" />}
              checkedIcon={<CheckBox fontSize="small" />}
              style={{ marginRight: 8 }}
              checked={selected}
              disabled={disabled}
              value={option.value}
            />
            {option.label}
          </>
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
