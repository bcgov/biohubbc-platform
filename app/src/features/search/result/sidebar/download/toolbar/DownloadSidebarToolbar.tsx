import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useMemo } from 'react';

export enum DOWNLOAD_SIDEBAR_VIEW {
  CART = 'cart',
  DOWNLOADS = 'downloads'
}

interface DownloadSidebarToolbarProps {
  activeView: DOWNLOAD_SIDEBAR_VIEW;
  onViewChange: (view: DOWNLOAD_SIDEBAR_VIEW) => void;
}

export const DownloadSidebarToolbar = ({ activeView, onViewChange }: DownloadSidebarToolbarProps) => {
  const { auth } = useAuthStateContext();

  const views = useMemo<ToggleButtonView<DOWNLOAD_SIDEBAR_VIEW>[]>(() => {
    const baseViews: ToggleButtonView<DOWNLOAD_SIDEBAR_VIEW>[] = [{ value: DOWNLOAD_SIDEBAR_VIEW.CART, label: 'Cart' }];

    // Downloads list requires authentication — anonymous users have no "my downloads"
    if (auth.isAuthenticated) {
      baseViews.push({ value: DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS, label: 'Downloads' });
    }

    return baseViews;
  }, [auth.isAuthenticated]);

  return <ToggleButtons views={views} activeView={activeView} onViewChange={onViewChange} orientation="horizontal" />;
};
