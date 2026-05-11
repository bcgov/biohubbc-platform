import { cleanup } from '@testing-library/react';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
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

vi.mock('components/toggle-button/ToggleButtons', () => ({
  ToggleButtons: () => <div data-testid="toggle-buttons" />
}));

const defaultProps = {
  sortOptions: [{ label: 'Relevance', value: 'relevancy_score', direction: 'desc' as const }],
  activeSort: 'relevancy_score',
  onSortChange: vi.fn(),
  view: SEARCH_RESULT_VIEW.TABLE,
  onViewChange: vi.fn(),
  viewOptions: SEARCH_RESULT_VIEW_OPTIONS
};

describe('SearchResultToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sort controls alongside the table/list toggle', () => {
    const { getByText, getByTestId } = render(<SearchResultToolbar {...defaultProps} />);

    expect(getByText('Relevance')).toBeInTheDocument();
    expect(getByTestId('toggle-buttons')).toBeInTheDocument();
  });
});
