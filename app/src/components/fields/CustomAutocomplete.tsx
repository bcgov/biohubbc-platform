import Autocomplete, { AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomTextField from './CustomTextField';

export interface ICustomAutocompleteOption<T extends string | number> {
  value: T;
  label: string;
}

export type ICustomAutocompleteProps<T extends string | number> = MuiAutocompleteProps<
  ICustomAutocompleteOption<T>,
  false,
  false,
  false
> & {
  label?: string;
};

/**
 * Reusable base single-select autocomplete without form library coupling.
 *
 * @template T
 * @param {ICustomAutocompleteProps<T>} props
 * @return {*}
 */
const CustomAutocomplete = <T extends string | number>(props: ICustomAutocompleteProps<T>) => {
  const { label, renderInput, ...rest } = props;

  return (
    <Autocomplete
      {...rest}
      renderInput={renderInput ?? ((params) => <CustomTextField {...params} label={label} />)}
    />
  );
};

export default CustomAutocomplete;
