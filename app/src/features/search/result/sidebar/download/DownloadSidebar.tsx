import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { CartContextFeature } from 'contexts/cartContext.interface';
import { DownloadSidebarCart } from './cart/DownloadSidebarCart';
import { DownloadSidebarDownloads } from './downloads/DownloadSidebarDownloads';
import { DownloadSidebarToolbar } from './toolbar/DownloadSidebarToolbar';

interface DownloadSidebarProps {
  cart: {
    features: CartContextFeature[];
    itemCount: number;
  };
  activeView: DOWNLOAD_SIDEBAR_VIEW;
  onViewChange: (view: DOWNLOAD_SIDEBAR_VIEW) => void;
  onDownload?: () => void;
}

export const DownloadSidebar = ({ cart, activeView, onViewChange, onDownload }: DownloadSidebarProps) => {
  const { features, itemCount } = cart;

  return (
    <Stack direction="column" height="100%" boxSizing="border-box" sx={{ display: 'flex' }}>
      <Box pb={1}>
        <DownloadSidebarToolbar activeView={activeView} onViewChange={onViewChange} />
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
            [DOWNLOAD_SIDEBAR_VIEW.CART]: <DownloadSidebarCart features={features} itemCount={itemCount} />,
            [DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS]: <DownloadSidebarDownloads />
          }}
        />
      </Box>

      {/* Fixed footer section — only visible on cart view */}
      {activeView === DOWNLOAD_SIDEBAR_VIEW.CART && (
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
      )}
    </Stack>
  );
};
