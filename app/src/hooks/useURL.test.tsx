import { act, cleanup, renderHook } from '@testing-library/react';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Route, Router } from 'react-router';
import useURL from './useURL';

const getWrapper = (history: MemoryHistory) => {
  const wrapper: React.FC = ({ children }) => (
    <Router history={history}>
      <Route path="test/:id/page">{children}</Route>
    </Router>
  );

  return wrapper;
};

describe('useURL', () => {
  afterAll(() => {
    jest.resetAllMocks();

    cleanup();
  });

  describe('mounting conditions', () => {
    it('should return an object with initial properties', async () => {
      const history = createMemoryHistory({ initialEntries: ['test/123/page?val0=0&val1=1'] });

      const { result } = renderHook(() => useURL(), { wrapper: getWrapper(history) });

      expect(result.current.path).toEqual('test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
    });
  });

  describe('replaceQueryParams', () => {
    it('should replace all initial query parameters', async () => {
      const history = createMemoryHistory({ initialEntries: ['test/123/page?val0=0&val1=1'] });

      const { result } = renderHook(() => useURL(), { wrapper: getWrapper(history) });

      // expect initial query params
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
      expect(result.current.path).toEqual('test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });

      act(() => result.current.replaceQueryParams({ val1: 2, val2: { objKey: 'objVal' } }));

      // expect replaced query params
      expect(result.current.queryParams).toEqual({ val1: 2, val2: { objKey: 'objVal' } });
      expect(result.current.path).toEqual('test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
    });
  });

  describe('appendQueryParams', () => {
    it('should append new query params to initial query parameters', async () => {
      const history = createMemoryHistory({ initialEntries: ['test/123/page?val0=0&val1=1'] });

      const wrapper: React.FC = ({ children }) => (
        <Router history={history}>
          <Route path="test/:id/page">{children}</Route>
        </Router>
      );

      const { result } = renderHook(() => useURL(), { wrapper });

      // expect initial query params
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 1 });
      expect(result.current.path).toEqual('test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });

      act(() => result.current.appendQueryParams({ val1: 2, val2: { objKey: 'objVal' } }));

      // expect replaced query params
      expect(result.current.queryParams).toEqual({ val0: 0, val1: 2, val2: { objKey: 'objVal' } });
      expect(result.current.path).toEqual('test/123/page');
      expect(result.current.pathParams).toEqual({ id: '123' });
    });
  });
});
