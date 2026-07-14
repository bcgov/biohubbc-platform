import { cleanup } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { DownloadSidebar } from './DownloadSidebar';

vi.mock('./downloads/DownloadSidebarDownloads', () => ({
  DownloadSidebarDownloads: () => <div data-testid="sidebar-downloads" />
}));

describe('DownloadSidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the downloads list', () => {
    const { getByTestId } = render(<DownloadSidebar />);

    expect(getByTestId('sidebar-downloads')).toBeVisible();
  });
});
