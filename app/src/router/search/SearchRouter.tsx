import { SearchResultPage } from 'features/search/result/SearchResultPage';
import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import SearchLayout from 'layouts/SearchLayout';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/search/` result pages.
 */
export const SearchRouter = () => {
  const location = useLocation();
  const defaultResultPath = `${PRIORITY_FEATURE_TYPE.SPECIES_OBSERVATION}${location.search}`;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultResultPath} replace />} />

      <Route
        path="/:featureType"
        element={
          <SearchLayout>
            <PageTitle title="Search Results" description="List of search results" />
            <SearchResultPage />
          </SearchLayout>
        }
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
