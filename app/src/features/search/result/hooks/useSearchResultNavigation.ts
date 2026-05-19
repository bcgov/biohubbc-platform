import { URL_PARAMS } from 'constants/query-params';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ISearchContainerLink } from '../../container/tab/SearchTabs.interface';

/**
 * Builds navigation handlers for search result interactions.
 *
 * Keeps router-specific behavior out of presentational components: result
 * detail navigation, feature-type tab navigation, and secured-data access route
 * changes.
 *
 * @param {ISearchContainerLink[]} featureTypeLinks - Current feature-type tab links, used to resolve tab values to routes.
 * @returns Handlers for result clicks, feature-type tab changes, and secured-data access requests.
 */
export const useSearchResultNavigation = (featureTypeLinks: ISearchContainerLink[]) => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Opens the detail page for a selected search result.
   * Preserves the current query string for back-navigation context.
   *
   * @param {SearchFeatureResultWithRelevancy} result - Result row selected by the user.
   */
  const handleResultClick = useCallback(
    (result: SearchFeatureResultWithRelevancy) => {
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

  /**
   * Opens the portal ticket flow for users requesting access to secured results.
   */
  const handleRequestAccess = useCallback(() => {
    navigate('/portal/ticket');
  }, [navigate]);

  return {
    handleResultClick,
    handleFeatureTypeTabChange,
    handleRequestAccess
  };
};
