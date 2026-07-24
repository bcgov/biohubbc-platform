import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { cleanup, render, screen } from 'test-helpers/test-utils';
import { SearchResultPanel } from './SearchResultPanel';

vi.mock('./option/SearchResultOptions', () => ({
  SearchResultOptions: () => <div data-testid="search-result-options" />
}));

const renderPanel = (view: SEARCH_RESULT_VIEW) =>
  render(
    <SearchResultPanel
      rows={[]}
      featureTypeProperties={[]}
      isLoading={false}
      pagination={{ current_page: 1, per_page: 10, total: 42, last_page: 5, sort: undefined, order: undefined }}
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
    });
  });

  describe('table and list views', () => {
    it.each([SEARCH_RESULT_VIEW.TABLE, SEARCH_RESULT_VIEW.LIST])('renders results and pagination for %s', (view) => {
      renderPanel(view);

      expect(screen.getByTestId('search-result-options')).toBeInTheDocument();
      expect(screen.queryByTestId('map-content')).not.toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });
});
