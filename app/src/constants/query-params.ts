export const URL_PARAMS = {
  FEATURE_TYPE: 'feature_type',
  SPECIES: 'species',
  SEARCH_QUERY: 'search',
  PAGE: 'page',
  LIMIT: 'limit',
  SORT: 'sort',
  ORDER: 'order'
} as const;

/** Type-safe keys: the values, not the object keys */
export type UrlParamKey = (typeof URL_PARAMS)[keyof typeof URL_PARAMS];
