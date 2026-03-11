import { CartContextProvider } from 'contexts/cartContext';
import { SearchResultPage } from 'features/search/result/SearchResultPage';
import { SearchPage } from 'features/search/SearchPage';
import { SubmissionFeaturePage } from 'features/submissions/page/features/SubmissionFeaturePage';
import { SubmissionDetailPage } from 'features/submissions/SubmissionDetailPage';
import BaseLayout from 'layouts/BaseLayout';
import SearchLayout from 'layouts/SearchLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/search/` pages.
 */
export const SearchRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route
        path="/"
        element={
          <BaseLayout>
            <PageTitle title="Search Data" description="Search and download data" />
            <SearchPage />
          </BaseLayout>
        }
      />

      <Route
        path="/list"
        element={
          <SearchLayout>
            <CartContextProvider>
              <PageTitle title="Search Results" description="List of search results" />
              <SearchResultPage />
            </CartContextProvider>
          </SearchLayout>
        }
      />

      {/* Route for submission details with meta */}
      <Route
        path="/:submissionId/feature/:submissionFeatureId"
        element={
          <BaseLayout>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionFeaturePage />
          </BaseLayout>
        }
      />

      <Route
        path="/:submissionId"
        element={
          <BaseLayout>
            <PageTitle title="Submission Details" description="Details of a specific submission" />
            <SubmissionDetailPage />
          </BaseLayout>
        }
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
