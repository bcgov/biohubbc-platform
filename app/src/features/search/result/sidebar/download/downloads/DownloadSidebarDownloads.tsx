import { mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, List, ListItem, Pagination, Stack, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useDownloadExportActions } from '../../../hooks/useDownloadExportActions';
import { ConfigureExportDialog } from '../ConfigureExportDialog';
import { DownloadFeatureCard } from '../feature/DownloadFeatureCard';

/**
 * Sidebar list of the current user's downloads, with per-download Export menu + Exports rows
 * delegated to `DownloadFeatureCard`. Presentational: all export/download behavior lives in
 * `useDownloadExportActions`; this component only composes the hook and renders.
 */
export const DownloadSidebarDownloads = () => {
  const {
    page,
    setPage,
    isLoading,
    downloads,
    lastPage,
    refresh,
    featureTypes,
    isConfigDialogOpen,
    isSubmittingConfig,
    handleCreateExport,
    handleConfigureExport,
    handleCreateConfigExport,
    handleCancelConfig,
    handleDownloadExportPart,
    handleDownloadExportAllParts,
    handleRebuildExport
  } = useDownloadExportActions();

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" px={1}>
        <IconButton size="small" title="Refresh downloads" onClick={() => refresh()} disabled={isLoading}>
          <Icon path={mdiRefresh} size={0.8} />
        </IconButton>
      </Stack>
      <LoadingGuard
        isLoading={isLoading}
        isLoadingFallback={<SkeletonList numberOfLines={5} />}
        hasNoData={!isLoading && downloads.length === 0}
        hasNoDataFallback={
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No downloads
          </Typography>
        }>
        <List dense disablePadding>
          {downloads.map((download) => (
            <ListItem key={download.download_id} disableGutters sx={{ width: 1, pb: 1 }}>
              <DownloadFeatureCard
                download={download}
                exports={download.exports}
                onCreateExport={handleCreateExport}
                onConfigureExport={handleConfigureExport}
                onDownloadExportPart={(exportId, chunkId) =>
                  handleDownloadExportPart(download.download_id, exportId, chunkId)
                }
                onDownloadExportAllParts={(exportId) => handleDownloadExportAllParts(download.download_id, exportId)}
                onRebuildExport={handleRebuildExport}
              />
            </ListItem>
          ))}
        </List>
        {lastPage > 1 ? (
          <Stack alignItems="center" py={1}>
            <Pagination count={lastPage} page={page} onChange={(_, newPage) => setPage(newPage)} size="small" />
          </Stack>
        ) : null}
      </LoadingGuard>
      <ConfigureExportDialog
        open={isConfigDialogOpen}
        isSubmitting={isSubmittingConfig}
        featureTypes={featureTypes}
        onCancel={handleCancelConfig}
        onSave={handleCreateConfigExport}
      />
    </>
  );
};
