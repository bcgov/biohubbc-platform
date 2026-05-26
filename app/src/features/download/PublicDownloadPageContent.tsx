import { mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DOWNLOAD_STATUS_BODY_COPY, DOWNLOAD_STATUS_CHIP_PROPS } from 'constants/download';
import { DownloadDetail } from 'interfaces/useDownloadApi.interface';

interface PublicDownloadPageContentProps {
  download: DownloadDetail;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Presentational body for the public download page. Renders the status chip,
 * an inline Refresh button (paired with the status so the user knows it
 * advances the status), the status-branched copy line, and the (optional)
 * policy description.
 *
 * Kept pure — no data loading, no auth lookups, no side effects — so the
 * status branches are trivially testable as render assertions.
 */
export const PublicDownloadPageContent = ({ download, isRefreshing, onRefresh }: PublicDownloadPageContentProps) => {
  const chip = DOWNLOAD_STATUS_CHIP_PROPS[download.status];
  const copy = DOWNLOAD_STATUS_BODY_COPY[download.status];

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip color={chip.color} label={chip.label} />
        <Button
          size="small"
          variant="outlined"
          onClick={onRefresh}
          disabled={isRefreshing}
          startIcon={
            isRefreshing ? <CircularProgress size={14} color="inherit" /> : <Icon path={mdiRefresh} size={0.7} />
          }>
          Refresh
        </Button>
      </Stack>
      <Typography>{copy}</Typography>
      {download.description && <Typography color="text.secondary">{download.description}</Typography>}
    </Stack>
  );
};
