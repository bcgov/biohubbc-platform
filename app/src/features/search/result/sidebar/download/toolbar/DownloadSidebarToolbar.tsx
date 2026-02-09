import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { useMemo } from 'react';

export enum DOWNLOAD_SIDEBAR_VIEW {
  CART = 'cart'
}

interface DownloadSidebarToolbarProps {
  activeView: DOWNLOAD_SIDEBAR_VIEW;
  onViewChange: (view: DOWNLOAD_SIDEBAR_VIEW) => void;
}

export const DownloadSidebarToolbar = ({ activeView, onViewChange }: DownloadSidebarToolbarProps) => {
  const views = useMemo<ToggleButtonView<DOWNLOAD_SIDEBAR_VIEW>[]>(
    () => [{ value: DOWNLOAD_SIDEBAR_VIEW.CART, label: 'Cart' }],
    []
  );

  return <ToggleButtons views={views} activeView={activeView} onViewChange={onViewChange} orientation="horizontal" />;
};
