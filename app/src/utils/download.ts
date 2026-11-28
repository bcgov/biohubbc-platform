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
