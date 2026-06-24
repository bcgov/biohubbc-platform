import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { DownloadSidebarDownloads } from './downloads/DownloadSidebarDownloads';

/**
 * Renders download controls inside the result-page right sidebar.
 *
 * @returns {JSX.Element} Download/sidebar content for the result page.
 */
export const DownloadSidebar = () => {
  return (
    <Stack direction="column" height="100%" boxSizing="border-box">
      <Box flex="1 1 auto" overflow="auto" sx={{ pb: 2 }}>
        <DownloadSidebarDownloads />
      </Box>
    </Stack>
  );
};
