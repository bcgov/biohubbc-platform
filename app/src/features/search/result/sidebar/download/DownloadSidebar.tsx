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
  /** Cart state shown in the cart view and used to enable checkout. */
  cart: {
    features: CartContextFeature[];
    itemCount: number;
  };
  /** Currently selected sidebar view. */
  activeView: DOWNLOAD_SIDEBAR_VIEW;
  /** Switches between cart and downloads views. */
  onViewChange: (view: DOWNLOAD_SIDEBAR_VIEW) => void;
  /** Starts checkout for the current cart contents. */
  onDownload?: () => void;
}

/**
 * Renders cart and download controls inside the result-page right sidebar.
 *
 * Keeps the toolbar, active view content, and cart checkout footer together.
 * The page-level download hook owns mutations and selected view state.
 *
 * @param {DownloadSidebarProps} props - Cart state, selected view, and sidebar callbacks.
 * @returns {JSX.Element} Download/sidebar content for the result page.
 */
export const DownloadSidebar = ({ cart, activeView, onViewChange, onDownload }: DownloadSidebarProps) => {
  const { features, itemCount } = cart;

  return (
    <Stack direction="column" height="100%" boxSizing="border-box">
      <Box pb={1}>
        <DownloadSidebarToolbar activeView={activeView} onViewChange={onViewChange} />
      </Box>

      <Divider flexItem sx={{ my: 1 }} />

      <Box flex="1 1 auto" overflow="auto" sx={{ pb: 2 }}>
        <ComponentSwitch<DOWNLOAD_SIDEBAR_VIEW>
          switch={activeView}
          components={{
            [DOWNLOAD_SIDEBAR_VIEW.CART]: <DownloadSidebarCart features={features} itemCount={itemCount} />,
            [DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS]: <DownloadSidebarDownloads />
          }}
        />
      </Box>

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
