import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Card, Chip, ChipProps, IconButton, Stack, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { isDownloadReady } from '../downloads/DownloadSidebarDownloads';

const statusChipProps: Record<string, { color: ChipProps['color']; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  processing: { color: 'info', label: 'Processing' },
  ready: { color: 'success', label: 'Ready' },
  downloaded: { color: 'success', label: 'Downloaded' },
  failed: { color: 'error', label: 'Failed' }
};

interface DownloadFeatureCardProps {
  download: DownloadRecord;
  onDownloadFragment: (downloadId: string, fragmentIndex: number) => void;
  onDownloadAll?: (downloadId: string, totalFragments: number) => void;
}

export const DownloadFeatureCard = ({ download, onDownloadFragment, onDownloadAll }: DownloadFeatureCardProps) => {
  const chipProps = statusChipProps[download.download_status] ?? { color: 'default', label: download.download_status };
  const ready = isDownloadReady(download.download_status);
  const multiFragment = download.total_fragments > 1;

  return (
    <Card variant="outlined" sx={{ width: 1, backgroundColor: grey[50] }}>
      <Stack sx={{ px: 1.5, py: 1 }} spacing={0.5}>
        {/* Row 1: Date + Status chip */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">{new Date(download.create_date).toLocaleDateString()}</Typography>
          <Chip size="small" color={chipProps.color} label={chipProps.label} />
        </Stack>

        {/* Row 2: Feature count + download button(s) */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {download.feature_count} {download.feature_count === 1 ? 'feature' : 'features'}
          </Typography>
          {ready && !multiFragment && (
            <IconButton
              size="small"
              data-testid="download-button"
              onClick={() => onDownloadFragment(download.download_id, 0)}
              title="Download">
              <Icon path={mdiDownload} size={0.8} />
            </IconButton>
          )}
        </Stack>

        {/* Multi-fragment: Download All button + individual parts */}
        {ready &&
          multiFragment && (
            <>
              {onDownloadAll && (
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  data-testid="download-all-button"
                  onClick={() => onDownloadAll(download.download_id, download.total_fragments)}
                  startIcon={<Icon path={mdiDownload} size={0.7} />}>
                  Download all {download.total_fragments} parts
                </Button>
              )}
              {Array.from({ length: download.total_fragments }, (_, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption">
                    Part {i + 1} of {download.total_fragments}
                  </Typography>
                  <IconButton
                    size="small"
                    data-testid={`download-part-button-${i}`}
                    onClick={() => onDownloadFragment(download.download_id, i)}
                    title={`Download part ${i + 1}`}>
                    <Icon path={mdiDownload} size={0.7} />
                  </IconButton>
                </Stack>
              ))}
            </>
          )}
      </Stack>
    </Card>
  );
};
