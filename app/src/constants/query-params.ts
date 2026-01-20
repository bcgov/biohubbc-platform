/**
 * URL query parameter keys used throughout the application.
 * Centralized to ensure consistency and prevent typos.
 */
export const URL_PARAMS = {
  /** Feature type filter parameter (e.g., ?ft=species_observation) */
  FEATURE_TYPE: 'ft',

  /** Search query parameter (e.g., ?q=lorem) */
  SEARCH_QUERY: 'q',

  /** Pagination - page number (e.g., ?page=2) */
  PAGE: 'page',

  /** Pagination - items per page (e.g., ?limit=25) */
  LIMIT: 'limit',

  /** Search section key (e.g., ?c=features) */
  CATEGORY: 'c'
} as const;

/**
 * Type-safe URL parameter keys
 */
export type UrlParamKey = (typeof URL_PARAMS)[keyof typeof URL_PARAMS];
