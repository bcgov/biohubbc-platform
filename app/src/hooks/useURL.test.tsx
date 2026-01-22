import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, renderHook } from 'test-helpers/test-utils';
import useURL from './useURL';

const getWrapper = (initialEntries: string[]) => {
  const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="test/:id/page" element={children} />
      </Routes>
    </MemoryRouter>
  );

  return wrapper;
};

describe('useURL', () => {
  afterAll(() => {
    vi.resetAllMocks();
    cleanup();
  });

  describe('mounting conditions', () => {
    it('should return an object with initial properties', async () => {
      // Use the full path matching the route definition with query params
      const initialEntries = ['/test/123/page?val0=0&val1=1'];
      const { result } = renderHook(() => useURL(), { wrapper: getWrapper(initialEntries) });

      expect(result.current.path).toEqual('/test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
    });
  });

  describe('replaceQueryParams', () => {
    it('should replace all initial query parameters', async () => {
      const initialEntries = ['/test/123/page?val0=0&val1=1'];
      const { result } = renderHook(() => useURL(), { wrapper: getWrapper(initialEntries) });

      // Expect initial query params
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
      expect(result.current.path).toEqual('/test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });

      act(() => result.current.replaceQueryParams({ val1: 2, val2: 'objVal' }));

      // Expect replaced query params
      expect(result.current.queryParams).toEqual({ val1: 2, val2: 'objVal' });
      expect(result.current.path).toEqual('/test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
    });
  });

  describe('appendQueryParams', () => {
    it('should append new query params to initial query parameters', async () => {
      const initialEntries = ['/test/123/page?val0=0&val1=1'];
      const { result } = renderHook(() => useURL(), { wrapper: getWrapper(initialEntries) });

      // Expect initial query params
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
      expect(result.current.path).toEqual('/test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });

      act(() => result.current.appendQueryParams({ val1: 2, val2: 'objVal' }));

      // Expect updated query params with new params appended
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 2, val2: 'objVal' });
      expect(result.current.path).toEqual('/test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
    });
  });
});
