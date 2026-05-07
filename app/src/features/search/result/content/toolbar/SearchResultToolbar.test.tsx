import { cleanup, fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchResultToolbar } from './SearchResultToolbar';

vi.mock('components/button/SortButton', () => ({
  SortButton: ({ children, ...props }: any) => (
    <button data-testid="sort-button" {...props}>
      {children}
    </button>
  )
}));

const defaultProps = {
  sortOptions: [{ label: 'Relevance', value: 'relevancy_score', direction: 'desc' as const }],
  activeSort: 'relevancy_score',
  onSortChange: vi.fn(),
  onAddAllToCart: vi.fn(),
  onDownloadAll: vi.fn()
};

describe('SearchResultToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders cart and download actions', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByRole('button', { name: /add all to cart/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /download all/i })).toBeInTheDocument();
  });

  it('calls onAddAllToCart on click', () => {
    const onAddAllToCart = vi.fn();
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} onAddAllToCart={onAddAllToCart} />);

    fireEvent.click(getByRole('button', { name: /add all to cart/i }));

    expect(onAddAllToCart).toHaveBeenCalledTimes(1);
  });

  it('calls onDownloadAll on click', () => {
    const onDownloadAll = vi.fn();
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} onDownloadAll={onDownloadAll} />);

    fireEvent.click(getByRole('button', { name: /download all/i }));

    expect(onDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('disables Download All while a download is in progress', () => {
    const onDownloadAll = vi.fn();
    const { getByRole } = render(
      <SearchResultToolbar {...defaultProps} onDownloadAll={onDownloadAll} isDownloading={true} />
    );

    const button = getByRole('button', { name: /download all/i });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDownloadAll).not.toHaveBeenCalled();
  });
});
