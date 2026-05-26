import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DOWNLOAD_STATUS_BODY_COPY, DOWNLOAD_STATUS_CHIP_PROPS } from 'constants/download';
import { DownloadDetail } from 'interfaces/useDownloadApi.interface';

interface PublicDownloadPageContentProps {
  download: DownloadDetail;
}

/**
 * Presentational body for the public download page. Renders the status chip,
 * the status-branched copy line, and the (optional) policy description.
 *
 * Kept pure — no data loading, no auth lookups, no side effects — so the
 * status branches are trivially testable as render assertions.
 */
export const PublicDownloadPageContent = ({ download }: PublicDownloadPageContentProps) => {
  const chip = DOWNLOAD_STATUS_CHIP_PROPS[download.status];
  const copy = DOWNLOAD_STATUS_BODY_COPY[download.status];

  return (
    <Stack spacing={2}>
      <Chip color={chip.color} label={chip.label} sx={{ alignSelf: 'flex-start' }} />
      <Typography>{copy}</Typography>
      {download.description && <Typography color="text.secondary">{download.description}</Typography>}
    </Stack>
  );
};
