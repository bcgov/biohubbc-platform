import { type DownloadExportStatus } from 'interfaces/useDownloadExportApi.interface';

/**
 * Predicate for "this export is ready for download". No `'downloaded'` branch because
 * `download_export.status` doesn't transition to `'downloaded'` — that's a `download`-only
 * terminal. Shared by the sidebar's behavior hook and `DownloadFeatureCard` via sibling import.
 */
export const isExportReady = (status: DownloadExportStatus): boolean => status === 'ready';

/**
 * Inject a hidden iframe that triggers a browser download of the given URL, then clean it up
 * after 30 seconds.
 *
 * Why iframe over `window.open`: popup blockers reject rapid-fire `window.open` calls (multi-
 * part downloads hit this), and browsers collapse concurrent tabs. The iframe technique
 * works around both problems and avoids stealing focus.
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
