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
 * Parses a route parameter that identifies a record into its numeric id.
 *
 * Route parameters arrive as strings and may be absent or malformed, so a page resolves them here before handing
 * them to child components: anything that is not a positive integer yields `null`, which the page treats as a
 * missing record rather than passing a falsy value down the tree.
 *
 * @param {string | undefined} value - Raw route parameter value.
 * @returns {number | null} The parsed id, or `null` when the parameter does not identify a record.
 */
export const parseRouteId = (value: string | undefined): number | null => {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return id > 0 ? id : null;
};

/**
 * Builds the path of the taxon page for a taxon referenced from a submission's features.
 *
 * @param {string} basePath - Submission route base, e.g. `/submission` or `/portal/submission`.
 * @param {number} submissionId - Submission the referencing feature belongs to.
 * @param {number} taxonId - BioHub taxon identifier.
 * @param {string} [search=''] - Query string (including the leading `?`) to carry over, if any.
 * @returns {string} Taxon page path.
 */
export const buildSubmissionTaxonPath = (
  basePath: string,
  submissionId: number,
  taxonId: number,
  search = ''
): string => `${basePath}/${submissionId}/taxon/${taxonId}${search}`;

/**
 * Builds the path of the code page for a codeset code referenced from a submission's features.
 *
 * Codeset and code keys are contributor-supplied text, so each is URL-encoded as its own path segment.
 *
 * @param {string} basePath - Submission route base, e.g. `/submission` or `/portal/submission`.
 * @param {number} submissionId - Submission the referencing feature belongs to.
 * @param {string} codesetKey - Machine-readable key of the codeset.
 * @param {string} codeKey - Machine-readable key of the code within the codeset.
 * @param {string} [search=''] - Query string (including the leading `?`) to carry over, if any.
 * @returns {string} Code page path.
 */
export const buildSubmissionCodePath = (
  basePath: string,
  submissionId: number,
  codesetKey: string,
  codeKey: string,
  search = ''
): string =>
  `${basePath}/${submissionId}/code/${encodeURIComponent(codesetKey)}/${encodeURIComponent(codeKey)}${search}`;

/**
 * Builds the path of a submission feature's detail page.
 *
 * @param {string} basePath - Submission route base, e.g. `/submission` or `/portal/submission`.
 * @param {string | number} submissionId - Submission the feature belongs to.
 * @param {string | number} submissionFeatureId - The feature.
 * @param {string} [search=''] - Query string (including the leading `?`) to carry over, if any.
 * @returns {string} Feature detail page path.
 */
export const buildSubmissionFeaturePath = (
  basePath: string,
  submissionId: string | number,
  submissionFeatureId: string | number,
  search = ''
): string => `${basePath}/${submissionId}/feature/${submissionFeatureId}${search}`;
