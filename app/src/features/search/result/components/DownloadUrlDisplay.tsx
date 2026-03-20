import { mdiCheck, mdiContentCopy } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, IconButton, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface DownloadUrlDisplayProps {
  url: string;
}

/**
 * Renders a download status URL with a copy-to-clipboard button.
 *
 * Anonymous users have no "My Downloads" page — the download UUID is their only
 * credential. This component surfaces the API status URL so they can check
 * download progress and retrieve signed download links when ready via curl.
 *
 * Clipboard API requires a secure context (HTTPS). On HTTP (local dev), the
 * copy button is hidden and the URL text is fully selectable as a fallback.
 */
export const DownloadUrlDisplay = ({ url }: DownloadUrlDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardAvailable = typeof navigator !== 'undefined' && !!navigator.clipboard;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed (e.g. permission denied) — URL is still selectable as text
    }
  };

  return (
    <Box
      data-testid="download-url-display"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography
        data-testid="download-url-text"
        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', flex: 1, userSelect: 'all' }}>
        {url}
      </Typography>
      {clipboardAvailable && (
        <IconButton
          data-testid="copy-url-button"
          size="small"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy download URL'}>
          <Icon path={copied ? mdiCheck : mdiContentCopy} size={0.8} />
        </IconButton>
      )}
    </Box>
  );
};
