import { renderHook } from 'test-helpers/test-utils';
import { useSearchResultNavigation } from './useSearchResultNavigation';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: ''
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ search: mocks.search })
  };
});

describe('useSearchResultNavigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.search = '';
  });

  describe('handleResultClick', () => {
    it('navigates to the feature detail page, preserving the current search query string', () => {
      mocks.search = '?keywords=moose&page=2';

      const { result } = renderHook(() => useSearchResultNavigation([]));

      result.current.handleResultClick({ submission_id: 3, submission_feature_id: 42 });

      expect(mocks.navigate).toHaveBeenCalledWith('/submission/3/feature/42?keywords=moose&page=2');
    });

    it('navigates without a query string when none is active', () => {
      const { result } = renderHook(() => useSearchResultNavigation([]));

      result.current.handleResultClick({ submission_id: 3, submission_feature_id: 42 });

      expect(mocks.navigate).toHaveBeenCalledWith('/submission/3/feature/42');
    });
  });
});
