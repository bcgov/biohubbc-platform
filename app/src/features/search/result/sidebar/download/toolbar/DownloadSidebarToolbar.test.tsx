import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { fireEvent, render, screen } from 'test-helpers/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { DownloadSidebarToolbar } from './DownloadSidebarToolbar';

describe('DownloadSidebarToolbar', () => {
  it('renders cart and downloads tabs', () => {
    render(<DownloadSidebarToolbar activeView={DOWNLOAD_SIDEBAR_VIEW.CART} onViewChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument();
  });

  it('changes to the downloads tab', () => {
    const onViewChange = vi.fn();
    render(<DownloadSidebarToolbar activeView={DOWNLOAD_SIDEBAR_VIEW.CART} onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Downloads' }));

    expect(onViewChange).toHaveBeenCalledWith(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
  });
});
