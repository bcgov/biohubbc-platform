import Alert, { AlertProps } from '@mui/material/Alert';

/**
 * Semantic alert banner for displaying contextual notifications.
 *
 * @param {AlertProps} props
 * @return {*}
 */
export const AlertBanner = (props: AlertProps) => {
  return <Alert severity="info" {...props} />;
};
