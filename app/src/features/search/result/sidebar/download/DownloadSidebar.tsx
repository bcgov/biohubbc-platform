import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { CartContextFeature } from 'contexts/cartContext.interface';
import { useState } from 'react';
import { DownloadSidebarCart } from './cart/DownloadSidebarCart';
import { DOWNLOAD_SIDEBAR_VIEW, DownloadSidebarToolbar } from './toolbar/DownloadSidebarToolbar';

interface DownloadSidebarProps {
  features: CartContextFeature[];
  itemCount: number;
  onDownload?: () => void;
}

export const DownloadSidebar = ({ features, itemCount, onDownload }: DownloadSidebarProps) => {
  const [activeView, setActiveView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);

  return (
    <Stack direction="column" height="100%" boxSizing="border-box" sx={{ display: 'flex' }}>
      <Box pb={1}>
        <DownloadSidebarToolbar activeView={activeView} onViewChange={setActiveView} />
      </Box>

      <Box py={1}>
        <Divider flexItem />
      </Box>

      {/* Scrollable content */}
      <Box
        flex="1 1 auto"
        overflow="auto"
        sx={{
          pb: 2
        }}>
        <ComponentSwitch<DOWNLOAD_SIDEBAR_VIEW>
          switch={activeView}
          components={{
            [DOWNLOAD_SIDEBAR_VIEW.CART]: <DownloadSidebarCart features={features} itemCount={itemCount} />
          }}
        />
      </Box>

      {/* Fixed footer section */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
        <Button variant="contained" fullWidth onClick={onDownload} disabled={!features.length}>
          Checkout
        </Button>
      </Box>
    </Stack>
  );
};
