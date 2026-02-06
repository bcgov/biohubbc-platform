import { Typography } from '@mui/material';
import { Box } from '@mui/system';

interface SubmissionUploadStatusRowProps {
  label: string;
  value: string | number;
}

/**
 * Key-value pair-like label for showing upload status information
 *
 * @param {SubmissionUploadStatusRowProps} props
 * @returns
 */
export const SubmissionUploadStatusRow = (props: SubmissionUploadStatusRowProps) => {
  const { label, value } = props;

  return (
    <Box display="flex" gap={2}>
      <Typography variant="body2" sx={{ minWidth: '120px' }} color="textSecondary">
        {label}:
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
};
