import Button, { ButtonProps } from '@mui/material/Button';

/**
 * Semantic primary call-to-action button.
 *
 * @param {ButtonProps} props
 * @return {*}
 */
export const PrimaryButton = (props: ButtonProps) => {
  return <Button variant="contained" color="primary" size="medium" {...props} />;
};
