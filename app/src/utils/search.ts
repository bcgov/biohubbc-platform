import { UrlParamKey } from 'constants/query-params';

export const buildSearchQuery = (root: string, params: Partial<Record<UrlParamKey, string | number>>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${root}?${queryString}` : root;
};
