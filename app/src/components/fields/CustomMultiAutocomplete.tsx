import Autocomplete, { AutocompleteProps as MuiAutocompleteProps } from '@mui/material/Autocomplete';
import CustomTextField from './CustomTextField';

export interface ICustomMultiAutocompleteOption {
  value: string | number;
  label: string;
}

export type ICustomMultiAutocompleteProps = MuiAutocompleteProps<ICustomMultiAutocompleteOption, true, false, false> & {
  label?: string;
};

/**
 * Reusable base multi-select autocomplete without form library coupling.
 *
 * @param {ICustomMultiAutocompleteProps} props
 * @return {*}
 */
const CustomMultiAutocomplete: React.FC<ICustomMultiAutocompleteProps> = (props) => {
  const { label, renderInput, ...rest } = props;

  return (
    <Autocomplete
      {...rest}
      renderInput={
        renderInput ?? ((params) => <CustomTextField {...params} label={label} InputLabelProps={{ shrink: true }} />)
      }
    />
  );
};

export default CustomMultiAutocomplete;
