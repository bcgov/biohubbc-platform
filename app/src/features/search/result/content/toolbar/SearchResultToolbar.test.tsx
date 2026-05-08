import { cleanup, fireEvent } from '@testing-library/react';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { render } from 'test-helpers/test-utils';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
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

vi.mock('hooks/useAuthStateContext');

const mockUseAuthStateContext = useAuthStateContext as Mock;

const defaultProps = {
  view: SEARCH_RESULT_OPTION_VIEW.LIST,
  onViewChange: vi.fn(),
  sortOptions: [{ label: 'Relevance', value: 'relevancy_score', direction: 'desc' as const }],
  activeSort: 'relevancy_score',
  onSortChange: vi.fn(),
  onAddAllToCart: vi.fn(),
  onCreateDownloadClick: vi.fn()
};

describe('SearchResultToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStateContext.mockReturnValue({ auth: { isAuthenticated: true } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Create Download button alongside Add All to Cart for authenticated users', () => {
    const { getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByRole('button', { name: /create download/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /add all to cart/i })).toBeInTheDocument();
  });

  it('hides the Create Download button for anonymous users', () => {
    mockUseAuthStateContext.mockReturnValue({ auth: { isAuthenticated: false } });

    const { queryByRole, getByRole } = render(<SearchResultToolbar {...defaultProps} />);

    expect(queryByRole('button', { name: /create download/i })).not.toBeInTheDocument();
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
