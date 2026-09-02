import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';
import { MouseEvent, useState } from 'react';
import { triggerIframeDownload } from 'utils/download';

interface DownloadVersionExportDownloadButtonProps {
  downloadId: string;
  downloadVersionExportId: string;
  status: DownloadExportStatus;
  partCount: number;
}

/**
 * Renders a per-export action that downloads every available export part to the client.
 *
 * The action resolves fresh presigned URLs when clicked instead of retaining expiring URLs in the
 * exports table. It is disabled until the export is ready and contains at least one part.
 *
 * @param {DownloadVersionExportDownloadButtonProps} props - Export identity and download readiness.
 * @return {JSX.Element} The version-export Download button.
 */
export const DownloadVersionExportDownloadButton = ({
  downloadId,
  downloadVersionExportId,
  status,
  partCount
}: DownloadVersionExportDownloadButtonProps) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * Resolve fresh URLs for the selected export and start a client download for every part.
   *
   * @param {MouseEvent<HTMLButtonElement>} event - Download button click event.
   * @return {Promise<void>} Resolves after all browser downloads have been started.
   */
  const handleDownload = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation();
    setIsDownloading(true);

    try {
      const exportDetail = await api.downloadExport.getExport(downloadId, downloadVersionExportId);

      if (!exportDetail.parts.length) {
        throw new Error('Export has no downloadable parts');
      }

      for (const part of exportDetail.parts) {
        triggerIframeDownload(part.url);
      }
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <PrimaryButton
      variant="text"
      startIcon={<Icon path={mdiDownload} size={0.8} />}
      loading={isDownloading}
      disabled={status !== 'ready' || partCount === 0}
      onClick={handleDownload}>
      Download
    </PrimaryButton>
  );
};
