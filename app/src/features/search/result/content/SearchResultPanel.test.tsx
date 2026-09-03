import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { cleanup, render, screen } from 'test-helpers/test-utils';
import { SearchResultPanel } from './SearchResultPanel';

vi.mock('./option/SearchResultOptions', () => ({
  SearchResultOptions: () => <div data-testid="search-result-options" />
}));

const panel = (view: SEARCH_RESULT_VIEW) => (
  <SearchResultPanel
    rows={[]}
    featureTypeProperties={[]}
    isLoading={false}
    cursor={{ limit: 10, sort: 'relevancy_score', order: 'desc', next: 'next-token', previous: null }}
    currentPage={1}
    totalCount={42}
    sortOptions={[]}
    activeSort=""
    view={view}
    viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
    isCreateDownloadDisabled={false}
    onCreateDownloadClick={vi.fn()}
    onSortChange={vi.fn()}
    onViewChange={vi.fn()}
    onResultClick={vi.fn()}
    onPageChange={vi.fn()}
    onPageSizeChange={vi.fn()}
    mapContent={<div data-testid="map-content" />}
  />
);

const renderPanel = (view: SEARCH_RESULT_VIEW) => render(panel(view));

describe('SearchResultPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('map view', () => {
    it('renders the map instead of the table/list', () => {
      renderPanel(SEARCH_RESULT_VIEW.MAP);

      expect(screen.getByTestId('map-content')).toBeInTheDocument();
      expect(screen.queryByTestId('search-result-options')).not.toBeInTheDocument();
    });

    it('hides pagination, because the map shows the whole result set at once', () => {
      renderPanel(SEARCH_RESULT_VIEW.MAP);

      expect(screen.queryByText('42')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('keeps the view toolbar available so the user can switch back', () => {
      renderPanel(SEARCH_RESULT_VIEW.MAP);

      expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
    });

    it('does not build the map until the map view is first opened', () => {
      const { rerender } = renderPanel(SEARCH_RESULT_VIEW.TABLE);

      expect(screen.queryByTestId('map-content')).not.toBeInTheDocument();

      rerender(panel(SEARCH_RESULT_VIEW.MAP));

      expect(screen.getByTestId('map-content')).toBeInTheDocument();
    });

    it('keeps the map mounted after switching back, so its session and viewport survive', () => {
      const { rerender } = renderPanel(SEARCH_RESULT_VIEW.MAP);

      rerender(panel(SEARCH_RESULT_VIEW.TABLE));

      // Hidden, not unmounted: unmounting drops the session and viewport, and re-requests every tile on return.
      expect(screen.getByTestId('map-content')).toBeInTheDocument();
      expect(screen.getByTestId('search-result-map-view')).not.toBeVisible();

      rerender(panel(SEARCH_RESULT_VIEW.MAP));

      expect(screen.getByTestId('search-result-map-view')).toBeVisible();
    });
  });

  describe('table view', () => {
    it('renders results and pagination', () => {
      renderPanel(SEARCH_RESULT_VIEW.TABLE);

      expect(screen.getByTestId('search-result-options')).toBeInTheDocument();
      expect(screen.queryByTestId('map-content')).not.toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders arrow-only pagination while total metadata is unavailable', () => {
      render(
        <SearchResultPanel
          rows={[]}
          featureTypeProperties={[]}
          isLoading={false}
          cursor={{ limit: 10, sort: 'relevancy_score', order: 'desc', next: 'next-token', previous: null }}
          currentPage={1}
          sortOptions={[]}
          activeSort=""
          view={SEARCH_RESULT_VIEW.TABLE}
          viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
          isCreateDownloadDisabled={false}
          onCreateDownloadClick={vi.fn()}
          onSortChange={vi.fn()}
          onViewChange={vi.fn()}
          onResultClick={vi.fn()}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      );

      expect(screen.getByText('Showing 0 rows')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /go to next page/i })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /^page \d+$/i })).not.toBeInTheDocument();
    });
  });
});
