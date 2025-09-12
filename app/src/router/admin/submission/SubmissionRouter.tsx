import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Routes } from 'react-router-dom';
import RouteWithMeta from 'utils/RouteWithMeta';
import { getTitle } from 'utils/Utils'; // Assuming this is a function to get the title

/**
 * Router for all `/submissions/*` pages.
 */
export const SubmissionsRouter = () => {
  return (
    <Routes>
      <RouteWithMeta
        path="/"
        title={getTitle('Submissions')}
        description="Browse and manage submissions"
        element={<SubmissionsListPage />}
      />
    </Routes>
  );
};
