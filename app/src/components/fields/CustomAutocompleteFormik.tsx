import { useFormikContext } from 'formik';
import get from 'lodash-es/get';
import { ReactNode, SyntheticEvent } from 'react';
import CustomAutocomplete, { ICustomAutocompleteOption, ICustomAutocompleteProps } from './CustomAutocomplete';
import CustomTextField from './CustomTextField';

export interface ICustomAutocompleteFormikProps<T extends string | number> extends Omit<
  ICustomAutocompleteProps<T>,
  'value' | 'onChange' | 'renderInput'
> {
  id: string;
  name: string;
  required?: boolean;
  /** Placeholder shown in the empty input. Pair with a "Select…" string to signal the field is a dropdown. */
  placeholder?: string;
  onChange?: (event: SyntheticEvent<Element, Event>, option: ICustomAutocompleteOption<T> | null) => void;
}

/**
 * Formik-connected wrapper around `CustomAutocomplete`.
 *
 * @template T
 * @param {ICustomAutocompleteFormikProps<T>} props
 * @return {*}
 */
const CustomAutocompleteFormik = <T extends string | number>(props: ICustomAutocompleteFormikProps<T>) => {
  const { touched, errors, setFieldValue, values, submitCount } = useFormikContext<any>();
  const { id, name, options, onChange, label, required, placeholder, ...rest } = props;

  const currentValue = get(values, name) as T | undefined;
  const selectedOption = options.find((option) => option.value === currentValue) ?? null;
  const showError = Boolean(get(errors, name)) && (Boolean(get(touched, name)) || submitCount > 0);
  const helperText = showError ? (get(errors, name) as ReactNode) : undefined;

  return (
    <CustomAutocomplete
      {...rest}
      id={id}
      data-testid={id}
      label={label}
      options={options}
      value={selectedOption}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      onChange={(event, option) => {
        onChange?.(event, option);
        setFieldValue(name, option?.value);
      }}
      renderInput={(params) => (
        <CustomTextField
          {...params}
          label={label}
          required={required}
          error={showError}
          helperText={helperText}
          placeholder={placeholder}
          // Keep the label shrunk so the "Select…" placeholder is visible in the empty input.
          InputLabelProps={{ ...params.InputLabelProps, ...(placeholder ? { shrink: true } : {}) }}
        />
      )}
    />
  );
};

export default CustomAutocompleteFormik;
