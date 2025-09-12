import DatasetPage from 'features/datasets/DatasetPage';
import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import RouteWithMeta from 'utils/RouteWithMeta';

/**
 * Router for all `/datasets/*` pages.
 *
 * @return {*}
 */
const DatasetsRouter = () => {
  return (
    <Routes>
      {/* Default redirect */}
      <RouteWithMeta
        path="/"
        element={<SubmissionsListPage />}
        title="Datasets"
        description="Browse submitted datasets"
      />

      {/* Route for dataset details with meta */}
      <RouteWithMeta
        path="/:id/details"
        element={<DatasetPage />}
        title="Dataset Details"
        description="Details of a specific dataset"
      />

      {/* Catch any unknown routes, and re-direct to the not found page */}
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};

export default DatasetsRouter;
