import { DefaultOptions } from '@tanstack/react-query';

/**
 * Default options for every query and mutation run through the app's QueryClient.
 *
 * - `retry: false`: a failed request surfaces immediately. The axios client already retries a 401 once
 *   after refreshing the token, so a second retry layer would only delay the error UI.
 * - `refetchOnWindowFocus` / `refetchOnReconnect: false`: data refetches when its query key changes, a
 *   component mounts, or a mutation invalidates it. Focus refetches would also re-sort server-sorted grids
 *   under the user.
 * - `staleTime: 0`: every mount of a query revalidates against the server; cached data is shown meanwhile.
 * - `networkMode: 'always'`: requests made while offline fail into the component's error state rather
 *   than pausing silently.
 */
export const QUERY_CLIENT_DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    networkMode: 'always'
  },
  mutations: {
    retry: false,
    networkMode: 'always'
  }
};
