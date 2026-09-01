import { URL_PARAMS } from 'constants/query-params';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ISearchContainerLink } from '../../container/tab/SearchTabs.interface';

/**
 * Builds navigation handlers for search result interactions.
 *
 * Keeps router-specific behavior out of presentational components: result
 * detail navigation and feature-type tab navigation.
 *
 * @param {ISearchContainerLink[]} featureTypeLinks - Current feature-type tab links, used to resolve tab values to routes.
 * @returns Handlers for result clicks and feature-type tab changes.
 */
export const useSearchResultNavigation = (featureTypeLinks: ISearchContainerLink[]) => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Opens the detail page for a selected search result.
   * Preserves the current query string for back-navigation context.
   *
   * Accepts only the identifiers it needs, so a feature selected on the map (whose tiles carry ids and nothing else)
   * navigates through exactly the same path as a table row.
   *
   * @param {Pick<SearchFeatureResultWithRelevancy, 'submission_id' | 'submission_feature_id'>} result - Selection.
   */
  const handleResultClick = useCallback(
    (result: Pick<SearchFeatureResultWithRelevancy, 'submission_id' | 'submission_feature_id'>) => {
      navigate(`/submission/${result.submission_id}/feature/${result.submission_feature_id}${location.search}`);
    },
    [location.search, navigate]
  );

  /**
   * Navigates to another feature-type result tab.
   * Preserves compatible query params and drops route-specific feature type/page
   * params that should not carry across tabs.
   *
   * @param {string} nextFeatureTypeName - Feature type value from the selected tab.
   */
  const handleFeatureTypeTabChange = useCallback(
    (nextFeatureTypeName: string) => {
      const nextLink = featureTypeLinks.find((link) => link.value === nextFeatureTypeName);

      if (nextLink) {
        const nextSearchParams = new URLSearchParams(location.search);
        nextSearchParams.delete(URL_PARAMS.FEATURE_TYPE);
        nextSearchParams.delete(URL_PARAMS.PAGE);
        const nextSearch = nextSearchParams.toString();
        navigate(nextSearch ? `${nextLink.to}?${nextSearch}` : nextLink.to);
      }
    },
    [featureTypeLinks, location.search, navigate]
  );

  return {
    handleResultClick,
    handleFeatureTypeTabChange
  };
};
