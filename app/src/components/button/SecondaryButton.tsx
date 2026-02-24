import Button, { ButtonProps } from '@mui/material/Button';

/**
 * Semantic secondary action button.
 *
 * @param {ButtonProps} props
 * @return {*}
 */
export const SecondaryButton = (props: ButtonProps) => {
  return <Button variant="outlined" color="primary" size="medium" {...props} />;
};
