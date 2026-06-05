import { ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { DOWNLOAD_SIDEBAR_VIEW, DOWNLOAD_SIDEBAR_VIEWS } from 'constants/download';

interface DownloadSidebarToolbarProps {
  activeView: DOWNLOAD_SIDEBAR_VIEW;
  onViewChange: (view: DOWNLOAD_SIDEBAR_VIEW) => void;
}

export const DownloadSidebarToolbar = ({ activeView, onViewChange }: DownloadSidebarToolbarProps) => {
  return (
    <ToggleButtons
      views={DOWNLOAD_SIDEBAR_VIEWS}
      activeView={activeView}
      onViewChange={onViewChange}
      orientation="horizontal"
    />
  );
};
