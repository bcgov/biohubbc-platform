import { URL_PARAMS } from 'constants/query-params';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ISearchContainerLink } from '../../container/tab/SearchTabs.interface';

/**
 * Builds navigation handlers for search result interactions.
 *
 * Use this hook from `SearchResultPage` to keep router-specific behavior out of
 * presentational components. It navigates from a result row to feature detail,
 * switches feature-type tabs while preserving applicable query params, and opens
 * the portal ticket route for secured data access requests.
 *
 * @param {ISearchContainerLink[]} featureTypeLinks - Current feature-type tab links, used to resolve tab values to routes.
 * @returns Handlers for result clicks, feature-type tab changes, and secured-data access requests.
 */
export const useSearchResultNavigation = (featureTypeLinks: ISearchContainerLink[]) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleResultClick = useCallback(
    (result: SearchFeatureResultWithRelevancy) => {
      navigate(`/submission/${result.submission_id}/feature/${result.submission_feature_id}${location.search}`);
    },
    [location.search, navigate]
  );

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

  const handleRequestAccess = useCallback(() => {
    navigate('/portal/ticket');
  }, [navigate]);

  return {
    handleResultClick,
    handleFeatureTypeTabChange,
    handleRequestAccess
  };
};
