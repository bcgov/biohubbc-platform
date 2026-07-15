import { mdiDownload } from '@mdi/js';
import { Icon } from '@mdi/react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

interface ResultPageContainerProps {
  /** Optional right rail content, such as the download sidebar. */
  rightSidebar?: React.ReactNode;
  /** Expanded right rail width in pixels. */
  rightSidebarWidth?: number;
  /** Title shown when the right rail is expanded. */
  rightSidebarTitle?: string;
  /** Main page content rendered beside the collapsible right rail. */
  children: React.ReactNode;
}

/**
 * Provides the two-column shell used by search result pages.
 *
 * Two-column result-page shell with a collapsible right sidebar. The sidebar
 * always initializes collapsed so result content is prioritized on entry.
 *
 * @param {ResultPageContainerProps} props - Main content plus optional sidebar configuration.
 * @returns {JSX.Element} Result page shell with a collapsed-by-default right rail.
 */
export const ResultPageContainer = ({
  rightSidebar,
  rightSidebarWidth = 350,
  rightSidebarTitle = 'Downloads',
  children
}: ResultPageContainerProps) => {
  const [rightCollapsed, setRightCollapsed] = useState(true);

  return (
    <Box sx={{ display: 'flex', height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>{children}</Box>

      <Box
        sx={{
          width: rightCollapsed ? 72 : rightSidebarWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.3s'
        }}>
        <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 0 }}>
          <Box sx={{ px: 2, pt: 2, flexShrink: 0 }}>
            {rightCollapsed ? (
              <IconButton size="small" onClick={() => setRightCollapsed(false)} sx={{ alignSelf: 'center' }}>
                <Icon path={mdiDownload} size={1.2} />
              </IconButton>
            ) : (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight="bold">
                  {rightSidebarTitle}
                </Typography>
                <IconButton size="small" onClick={() => setRightCollapsed(true)}>
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            )}
          </Box>

          {!rightCollapsed && <Box sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 0 }}>{rightSidebar}</Box>}
        </Paper>
      </Box>
    </Box>
  );
};
