import { cleanup, fireEvent } from '@testing-library/react';
import { createMockFeature } from 'test-helpers/cart-helpers';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadSidebar } from './DownloadSidebar';
import { DOWNLOAD_SIDEBAR_VIEW } from './toolbar/DownloadSidebarToolbar';

vi.mock('./cart/DownloadSidebarCart', () => ({
  DownloadSidebarCart: () => <div data-testid="sidebar-cart" />
}));

vi.mock('./toolbar/DownloadSidebarToolbar', () => ({
  DOWNLOAD_SIDEBAR_VIEW: { CART: 'cart', DOWNLOADS: 'downloads' },
  DownloadSidebarToolbar: () => <div data-testid="sidebar-toolbar" />
}));

const defaultProps = {
  activeView: DOWNLOAD_SIDEBAR_VIEW.CART,
  onViewChange: vi.fn()
};

const mockFeatures = [
  createMockFeature('saved-1', 1, 101, 201, 'Feature A'),
  createMockFeature('saved-2', 2, 102, 202, 'Feature B')
];

describe('DownloadSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders checkout button with correct label', () => {
    const { getByRole } = render(<DownloadSidebar {...defaultProps} features={mockFeatures} itemCount={2} />);

    expect(getByRole('button', { name: /checkout/i })).toBeInTheDocument();
  });

  it('enables the checkout button when features exist', () => {
    const { getByRole } = render(<DownloadSidebar {...defaultProps} features={mockFeatures} itemCount={2} />);

    expect(getByRole('button', { name: /checkout/i })).not.toBeDisabled();
  });

  it('disables the checkout button when cart is empty', () => {
    const { getByRole } = render(<DownloadSidebar {...defaultProps} features={[]} itemCount={0} />);

    expect(getByRole('button', { name: /checkout/i })).toBeDisabled();
  });

  it('calls onDownload when checkout button is clicked', () => {
    const handleDownload = vi.fn();
    const { getByRole } = render(
      <DownloadSidebar {...defaultProps} features={mockFeatures} itemCount={2} onDownload={handleDownload} />
    );

    fireEvent.click(getByRole('button', { name: /checkout/i }));

    expect(handleDownload).toHaveBeenCalledTimes(1);
  });
});
