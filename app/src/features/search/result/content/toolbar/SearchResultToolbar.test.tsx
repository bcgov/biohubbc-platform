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
  onCreateDownloadClick: vi.fn()
};

describe('SearchResultToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Create Download button alongside Add All to Cart', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByRole('button', { name: /create download/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /add all to cart/i })).toBeInTheDocument();
  });

  it('calls onCreateDownloadClick on click', () => {
    const onCreateDownloadClick = vi.fn();
    const { getByRole } = render(
      <SearchResultToolbar {...defaultProps} onCreateDownloadClick={onCreateDownloadClick} />
    );

    fireEvent.click(getByRole('button', { name: /create download/i }));

    expect(onCreateDownloadClick).toHaveBeenCalledTimes(1);
  });
});
