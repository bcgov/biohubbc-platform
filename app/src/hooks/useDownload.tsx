import { useDialogContext } from './useContext';

const useDownload = () => {
  const dialogContext = useDialogContext();
  /**
   * Handler for downloading raw data as JSON.
   * Note: currently this does not zip the file. Can be modified if needed.
   *
   * @param {any} data - Data to download.
   * @param {string} fileName - Name of file excluding file extension ie: file1.
   */
  const downloadJSON = (data: any, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, undefined, 2)], { type: 'application/json' });

    const link = document.createElement('a');

    const sanitizedFileName = fileName.replace(/[^a-zA-Z ]/g, '');

    link.download = `Biohub-${sanitizedFileName}.json`;

    link.href = URL.createObjectURL(blob);

    link.click();

    URL.revokeObjectURL(link.href);
  };

  /**
   * Downloads or views a signed url.
   * Displays error dialog if signedUrlService throws error.
   * Note: Allows a promise to be passed to handle different api services.
   *
   * @async
   * @param {Promise<string> | string} params
   * @returns {Promise<void>}
   */
  const downloadSignedUrl = async (signedUrl: Promise<string> | string) => {
    try {
      const url = await signedUrl;

      window.open(url, '_blank');
    } catch (err: any) {
      dialogContext.setErrorDialog({
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        dialogTitle: 'Download Error',
        dialogText: err.message,
        open: true
      });
    }
  };
  return { downloadJSON, downloadSignedUrl };
};

export default useDownload;
