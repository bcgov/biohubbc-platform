import SubmissionsListPage from 'features/submissions/list/SubmissionsListPage';
import { Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { getTitle } from 'utils/Utils';

/**
 * Router for all `/submissions/` pages.
 */
export const SubmissionsRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <PageTitle title={getTitle('Submissions')} description="Browse and manage submissions" />
            <SubmissionsListPage />
          </>
        }
      />
    </Routes>
  );
};
