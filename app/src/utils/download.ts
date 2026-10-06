import { type DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';

/**
 * Determine whether an export is ready to be downloaded.
 *
 * @param {DownloadExportStatus} status - Current export processing status.
 * @return {boolean} `true` when the export is ready; otherwise `false`.
 */
export const isExportReady = (status: DownloadExportStatus): boolean => status === 'ready';

/**
 * Trigger a browser download for a presigned URL without opening a new tab.
 *
 * A hidden iframe avoids popup blocking when an export contains multiple parts. The iframe is
 * removed after the browser has had enough time to begin transferring the file.
 *
 * @param {string} url - Fresh presigned URL for the file being downloaded.
 * @return {void}
 */
export const triggerIframeDownload = (url: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
  }, 30000);
};
