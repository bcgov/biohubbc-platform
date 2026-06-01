import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PropsWithChildren } from 'react';

type TicketUploadReviewRowLayoutProps = PropsWithChildren<{
  label: string;
}>;

/**
 * Shared row chrome for submission upload review timeline rows.
 *
 * @param {TicketUploadReviewRowLayoutProps} props
 * @return {*}
 */
export const TicketUploadReviewRowLayout = (props: TicketUploadReviewRowLayoutProps) => {
  const { label, children } = props;

  return (
    <Box
      sx={{
        px: 2,
        py: 2,
        minHeight: 64,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
      <Typography variant="body2" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      {children}
    </Box>
  );
};
