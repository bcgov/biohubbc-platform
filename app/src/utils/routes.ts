import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';

/**
 * Builds a search result URL for a feature type and optional query params.
 *
 * Use this whenever navigating to a feature-type search result page from search
 * tabs, preview list items, redirects, or other internal UI. It uses the feature
 * type name directly as the route segment and omits empty query values so
 * callers can pass partial param objects without producing blank URL parameters.
 *
 * @param {string} featureTypeName - Feature type name to place in the search URL path.
 * @param {Partial<Record<string, string | number | undefined>>} [params] - Optional query parameter values.
 * @returns {string} Search result URL for the feature type and supplied query parameters.
 */
export const buildSearchFeatureTypePath = (
  featureTypeName: string,
  params?: Partial<Record<string, string | number | undefined>>
): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const path = `/search/${featureTypeName}`;

  return queryString ? `${path}?${queryString}` : path;
};

/**
 * Resolves a route feature-type segment into page display metadata.
 *
 * Use this on search result pages after feature-type metadata has loaded. It
 * returns `null` for missing or unsupported route segments so callers can route
 * to the not-found page, and otherwise returns the normalized feature type name
 * plus the configured or API-provided page title.
 *
 * @param {string | undefined} route - Raw `:featureType` route parameter from the search URL.
 * @param {{ feature_type: { name: string; display_name: string } }[]} [availableFeatureTypes] - Feature types available from code metadata.
 * @returns {{ featureTypeName: string; title: string } | null} Search page route metadata, or null when the route is invalid.
 */
export const getSearchFeatureTypeRouteConfig = (
  route: string | undefined,
  availableFeatureTypes: { feature_type: { name: string; display_name: string } }[] = []
): { featureTypeName: string; title: string } | null => {
  const featureTypeName = route?.trim().toLowerCase();

  if (!featureTypeName) {
    return null;
  }

  const featureType = availableFeatureTypes.find((item) => item.feature_type.name === featureTypeName);

  if (!featureType) {
    return null;
  }

  const configuredLabel = FEATURE_TYPE_CONFIG[featureTypeName as PRIORITY_FEATURE_TYPE]?.label;

  return {
    featureTypeName,
    title: configuredLabel ?? featureType.feature_type.display_name
  };
};

/**
 * Builds the path of the taxon page for a taxon referenced from a submission's features.
 *
 * @param {string} basePath - Submission route base, e.g. `/submission` or `/portal/submission`.
 * @param {string | number} submissionId - Submission the referencing feature belongs to.
 * @param {number} taxonId - BioHub taxon identifier.
 * @param {string} [search=''] - Query string (including the leading `?`) to carry over, if any.
 * @returns {string} Taxon page path.
 */
export const buildSubmissionTaxonPath = (
  basePath: string,
  submissionId: string | number,
  taxonId: number,
  search = ''
): string => `${basePath}/${submissionId}/taxon/${taxonId}${search}`;
