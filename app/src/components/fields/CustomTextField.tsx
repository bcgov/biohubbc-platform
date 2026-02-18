import TextField, { TextFieldProps } from '@mui/material/TextField';

/**
 * Reusable base text field component without form library coupling.
 *
 * @param {TextFieldProps} props
 * @return {*}
 */
const CustomTextField = (props: TextFieldProps) => {
  return <TextField {...props} />;
};

export default CustomTextField;
