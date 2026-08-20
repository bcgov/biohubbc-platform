import Autocomplete, { AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomTextField from './CustomTextField';

export interface ICustomAutocompleteOption<T extends string | number> {
  value: T;
  label: string;
}

export type ICustomAutocompleteProps<
  T extends string | number,
  FreeSolo extends boolean = false
> = MuiAutocompleteProps<ICustomAutocompleteOption<T>, false, false, FreeSolo> & {
  label?: string;
};

/**
 * Reusable base single-select autocomplete without form library coupling.
 *
 * @template T
 * @param {ICustomAutocompleteProps<T>} props
 * @return {*}
 */
const CustomAutocomplete = <T extends string | number, FreeSolo extends boolean = false>(
  props: ICustomAutocompleteProps<T, FreeSolo>
) => {
  const { label, renderInput, ...rest } = props;

  return (
    <Autocomplete {...rest} renderInput={renderInput ?? ((params) => <CustomTextField {...params} label={label} />)} />
  );
};

export default CustomAutocomplete;
