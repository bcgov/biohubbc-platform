import { cleanup, fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_RESULT_OPTION_VIEW } from '../../SearchResultPage';
import { SearchResultToolbar } from './SearchResultToolbar';

vi.mock('components/button/SortButton', () => ({
  SortButton: ({ children, ...props }: any) => (
    <button data-testid="sort-button" {...props}>
      {children}
    </button>
  )
}));

vi.mock('components/toggle-button/ToggleButtons', () => ({
  ToggleButtons: () => <div data-testid="toggle-buttons" />
}));

const defaultProps = {
  view: SEARCH_RESULT_OPTION_VIEW.LIST,
  onViewChange: vi.fn(),
  sortOptions: [{ label: 'Relevance', value: 'relevancy_score', direction: 'desc' as const }],
  activeSort: 'relevancy_score',
  onSortChange: vi.fn(),
  handleAddAllToCart: vi.fn(),
  handleDownloadAll: vi.fn()
};

describe('SearchResultToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Download All button alongside Add All to Cart', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByRole('button', { name: /download all/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /add all to cart/i })).toBeInTheDocument();
  });

  it('disables Download All button when isDownloading is true', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} isDownloading={true} />);

    expect(getByRole('button', { name: /download all/i })).toBeDisabled();
  });

  it('enables Download All button when isDownloading is not provided', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByRole('button', { name: /download all/i })).not.toBeDisabled();
  });

  it('calls handleDownloadAll on click', () => {
    const handleDownloadAll = vi.fn();
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} handleDownloadAll={handleDownloadAll} />);

    fireEvent.click(getByRole('button', { name: /download all/i }));

    expect(handleDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('does not call handleDownloadAll when disabled', () => {
    const handleDownloadAll = vi.fn();
    const { getByRole } = render(
      <SearchResultToolbar {...defaultProps} handleDownloadAll={handleDownloadAll} isDownloading={true} />
    );

    fireEvent.click(getByRole('button', { name: /download all/i }));

    expect(handleDownloadAll).not.toHaveBeenCalled();
  });
});
