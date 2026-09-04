import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PropsWithChildren } from 'react';

interface TicketUploadReviewRowLayoutProps {
  label: string;
}

/**
 * Shared row chrome for submission upload review timeline rows.
 *
 * @param {PropsWithChildren<TicketUploadReviewRowLayoutProps>} props - Component props.
 * @returns {JSX.Element} Submission upload review timeline row layout.
 */
export const TicketUploadReviewRowLayout = (props: PropsWithChildren<TicketUploadReviewRowLayoutProps>) => {
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
      <Typography variant="body2" fontWeight={700}>
        {label}
      </Typography>
      {children}
    </Box>
  );
};
