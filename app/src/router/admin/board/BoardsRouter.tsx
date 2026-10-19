import { AdminBoardsPage } from 'features/admin2/boards/AdminBoardsPage';
import { AdminBoardPage } from 'features/admin2/boards/detail/AdminBoardPage';
import { AdminBoardSettingsPage } from 'features/admin2/boards/settings/AdminBoardSettingsPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/admin/boards/` pages: the boards list, a board's view and its settings.
 *
 * @returns {JSX.Element} The board routes.
 */
export const BoardsRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Boards" description="Browse and manage ticket boards" />
            <AdminBoardsPage />
          </>
        }
      />

      <Route
        path="/:boardId"
        element={
          <>
            <PageTitle title="Board" description="View a board's tickets by swimlane" />
            <AdminBoardPage />
          </>
        }
      />

      <Route
        path="/:boardId/settings"
        element={
          <>
            <PageTitle title="Board Settings" description="Manage a board and its swimlanes" />
            <AdminBoardSettingsPage />
          </>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
