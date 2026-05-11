import { mdiDownload } from '@mdi/js';
import { Icon } from '@mdi/react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

interface ResultPageContainerProps {
  rightSidebar?: React.ReactNode;
  rightSidebarWidth?: number;
  rightSidebarTitle?: string;
  children: React.ReactNode;
}

export const ResultPageContainer = ({
  rightSidebar,
  rightSidebarWidth = 350,
  rightSidebarTitle = 'Downloads',
  children
}: ResultPageContainerProps) => {
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>{children}</Box>

      {/* Right Sidebar */}
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
          {/* Header */}
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

          {/* Scrollable content */}
          {!rightCollapsed && <Box sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 0 }}>{rightSidebar}</Box>}
        </Paper>
      </Box>
    </Box>
  );
};
