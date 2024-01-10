import { useDialogContext } from './useContext';

const useDownload = () => {
  const dialogContext = useDialogContext();
  /**
   * handler for downloading raw data as JSON
   * Note: currently this does not zip the file. Can be modified if needed.
   *
   * @param {any} data - to download
   * @param {string} fileName - name of file excluding file extension ie: file1
   */
  const downloadJSON = (data: any, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, undefined, 2)], { type: 'application/json' });

    const link = document.createElement('a');

    link.download = `${fileName}.json`;

    link.href = URL.createObjectURL(blob);

    link.click();

    URL.revokeObjectURL(link.href);
  };

  /**
   * Downloads / views a signed url
   * displays error dialog if signedUrlService throws error
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} params
   * @returns {Promise<[void]>}
   */
  const downloadSignedUrl = async (signedUrlService: Promise<string>) => {
    try {
      const signedUrl = await signedUrlService;

      window.open(signedUrl, '_blank');
    } catch (err) {
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
