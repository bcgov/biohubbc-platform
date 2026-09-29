import { DefaultOptions } from '@tanstack/react-query';

/**
 * Default options for every query and mutation run through the app's QueryClient.
 *
 * - `retry: false`: a failed request surfaces immediately. The axios client already retries a 401 once
 *   after refreshing the token, so a second retry layer would only delay the error UI.
 * - `refetchOnWindowFocus` / `refetchOnReconnect: false`: data refetches when its query key changes, a
 *   component mounts, or a mutation invalidates it. Focus refetches would also re-sort server-sorted grids
 *   under the user.
 * - `staleTime: 5s`: a component mounting more than a few seconds after its data loaded revalidates it, showing
 *   the cached data meanwhile. The window covers sections a page renders only once its data has arrived, which
 *   would otherwise each refetch it on mount. Invalidation always refetches, whatever the data's age.
 * - `networkMode: 'always'`: requests made while offline fail into the component's error state rather
 *   than pausing silently.
 */
export const QUERY_CLIENT_DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5_000,
    networkMode: 'always'
  },
  mutations: {
    retry: false,
    networkMode: 'always'
  }
};
