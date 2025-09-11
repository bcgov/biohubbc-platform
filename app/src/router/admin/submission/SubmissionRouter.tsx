import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Route, Routes } from 'react-router';
import RouteWithTitle from 'utils/RouteWithTitle';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/submissions/*` pages.
 */
export const SubmissionsRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RouteWithTitle title={getTitle('Submissions')}>
            <SubmissionsListPage />
          </RouteWithTitle>
        }
      />
    </Routes>
  );
};
