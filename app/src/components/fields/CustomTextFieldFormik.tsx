import { TextFieldProps } from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import get from 'lodash-es/get';
import CustomTextField from './CustomTextField';

export interface ICustomTextFieldFormikProps extends Omit<TextFieldProps, 'name' | 'value' | 'error' | 'helperText'> {
  name: string;
  /**
   * Replaces Formik's default change handler, for a field that normalizes what is typed or pasted before setting it.
   */
  onChange?: TextFieldProps['onChange'];
}

/**
 * Formik-connected text field wrapper around `CustomTextField`.
 *
 * @param {ICustomTextFieldFormikProps} props
 * @return {*}
 */
const CustomTextFieldFormik = (props: ICustomTextFieldFormikProps) => {
  const { touched, errors, values, handleChange, submitCount } = useFormikContext<any>();
  const { name, ...rest } = props;
  const showError = Boolean(get(errors, name)) && (Boolean(get(touched, name)) || submitCount > 0);

  return (
    <CustomTextField
      name={name}
      id={name}
      data-testid={name}
      onChange={handleChange}
      value={get(values, name) ?? ''}
      error={showError}
      helperText={showError ? <>{get(errors, name) as string}</> : undefined}
      {...rest}
    />
  );
};

export default CustomTextFieldFormik;
