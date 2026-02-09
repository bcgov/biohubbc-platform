import { mdiDownload, mdiFilterVariant } from '@mdi/js';
import { Icon } from '@mdi/react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

interface ResultPageLayoutProps {
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  leftSidebarWidth?: number;
  rightSidebarWidth?: number;
  children: React.ReactNode;
}

export const ResultPageLayout = ({
  leftSidebar,
  rightSidebar,
  leftSidebarWidth = 350,
  rightSidebarWidth = 350,
  children
}: ResultPageLayoutProps) => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%', // fill parent container
        maxHeight: '100%', // allow max height constraint from parent
        overflow: 'hidden'
      }}>
      {/* Left Sidebar */}
      <Box
        sx={{
          width: leftCollapsed ? 72 : leftSidebarWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.3s'
        }}>
        <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 0 }}>
          {/* Header */}
          <Box sx={{ px: 2, pt: 2, flexShrink: 0 }}>
            {leftCollapsed ? (
              <IconButton size="small" onClick={() => setLeftCollapsed(false)} sx={{ alignSelf: 'center' }}>
                <Icon path={mdiFilterVariant} size={1.2} />
              </IconButton>
            ) : (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight="bold">
                  Filters
                </Typography>
                <IconButton size="small" onClick={() => setLeftCollapsed(true)}>
                  <ChevronLeftIcon />
                </IconButton>
              </Stack>
            )}
          </Box>

          {/* Scrollable content */}
          {!leftCollapsed && <Box sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 0 }}>{leftSidebar}</Box>}
        </Paper>
      </Box>

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
                  Downloads
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
