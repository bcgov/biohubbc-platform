import Button, { ButtonProps } from '@mui/material/Button';

/**
 * Semantic destructive action button.
 *
 * @param {ButtonProps} props
 * @return {*}
 */
export const DangerButton = (props: ButtonProps) => {
  return <Button variant="contained" color="error" size="medium" {...props} />;
};
