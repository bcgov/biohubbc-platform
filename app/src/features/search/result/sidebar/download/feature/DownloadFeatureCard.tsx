import { Card, Chip, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { DOWNLOAD_STATUS_CHIP_PROPS } from 'constants/download';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';

interface DownloadFeatureCardProps {
  download: DownloadRecord;
}

/**
 * Placeholder render for a user's download request.
 *
 * Shows the request's create date and current status chip only. The user-facing
 * "Export" action and per-file export list land in the follow-up ticket
 * (docs/download-export-separation/ticket.md); until then, the card reflects
 * that the Parquet snapshot is building or has landed on S3 with no interactive
 * action. The card must stay non-interactive — adding a button here would
 * pre-empt the follow-up ticket's UX design.
 */
export const DownloadFeatureCard = ({ download }: DownloadFeatureCardProps) => {
  const chipProps = DOWNLOAD_STATUS_CHIP_PROPS[download.download_status] ?? {
    color: 'default',
    label: download.download_status
  };

  return (
    <Card variant="outlined" sx={{ width: 1, backgroundColor: grey[50] }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1 }}>
        <Typography variant="body2">{new Date(download.create_date).toLocaleDateString()}</Typography>
        <Chip size="small" color={chipProps.color} label={chipProps.label} />
      </Stack>
    </Card>
  );
};
