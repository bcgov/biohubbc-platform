import { mdiDownload } from '@mdi/js';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import Icon from '@mdi/react';
import { useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { EXPORT_CONFIG_VERSION, EXPORT_TYPE } from 'constants/export-config-constants';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { DownloadStatus } from 'interfaces/useDownloadApi.interface';
import { CreateExportPayload } from 'interfaces/useDownloadExportApi.interface';
import { MouseEvent, useState } from 'react';

interface DownloadVersionExportButtonProps {
  downloadId: string;
  downloadVersionId: string;
  status: DownloadStatus;
}

/**
 * Renders an action that starts the standard per-feature-type CSV export for one download version.
 *
 * @param {DownloadVersionExportButtonProps} props - Selected download and version export state.
 * @return {JSX.Element} The version-aware Export button.
 */
export const DownloadVersionExportButton = ({
  downloadId,
  downloadVersionId,
  status
}: DownloadVersionExportButtonProps) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Create a per-feature-type CSV export for the selected version, then refresh the download's cached exports.
   *
   * @param {MouseEvent<HTMLButtonElement>} event - The export button click event.
   * @return {Promise<void>}
   */
  const handleExport = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation();
    setIsExporting(true);

    try {
      const featureTypes = await api.downloadExport.getDownloadVersionFeatureTypes(downloadId, downloadVersionId);
      const payload: CreateExportPayload = {
        version: EXPORT_CONFIG_VERSION,
        export_type: EXPORT_TYPE,
        mode: 'per_feature_type',
        feature_types: featureTypes.map((featureType) => featureType.feature_type),
        merge_steps: []
      };
      await api.downloadExport.createExport(downloadId, downloadVersionId, payload);
      void refreshChangedQueries(queryClient, changedQueryKeys.downloadExport(downloadId, downloadVersionId));
      dialogContext.setSnackbar({ open: true, snackbarMessage: 'Export started.' });
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Export Error',
        dialogText: 'Failed to start the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PrimaryButton
      variant="text"
      startIcon={<Icon path={mdiDownload} size={0.8} />}
      loading={isExporting}
      disabled={status !== 'ready'}
      onClick={handleExport}>
      Export
    </PrimaryButton>
  );
};
