import DatasetPage from 'features/datasets/DatasetPage';
import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/datasets/` pages.
 */
const DatasetsRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Datasets" description="Browse submitted datasets" />
            <SubmissionsListPage />
          </>
        }
      />
      {/* Route for dataset details with meta */}
      <Route
        path="/:id/details"
        element={
          <>
            <PageTitle title="Dataset Details" description="Details of a specific dataset" />
            <DatasetPage />
          </>
        }
      />
      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
export default DatasetsRouter;
