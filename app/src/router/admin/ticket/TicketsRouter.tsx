import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminTicketContextProvider } from 'contexts/ticketContext';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { AdminTicketsPage } from 'features/admin2/tickets/AdminTicketsPage';
import { AdminBoardPage } from 'features/admin2/boards/detail/AdminBoardPage';
import { AdminTagPage } from 'features/admin2/tags/detail/AdminTagPage';

/**
 * Router for all `/tickets/` pages: the tickets, boards and tags tabs, a board's page, a tag's page and a ticket's
 * page.
 *
 * @return {*}
 */
export const TicketsRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Tickets" description="Browse and manage administrative tickets" />
            <AdminTicketsPage />
          </>
        }
      />

      {/* Static segments outrank `/:ticketId`, so `boards` and `tags` are never read as ticket ids. */}
      <Route
        path="/boards/:boardId"
        element={
          <>
            <PageTitle title="Board" description="View the tickets and tags of a ticket board" />
            <AdminBoardPage />
          </>
        }
      />

      <Route
        path="/tags/:tagId"
        element={
          <>
            <PageTitle title="Tag" description="View and manage the rules that apply a ticket tag" />
            <AdminTagPage />
          </>
        }
      />

      <Route
        path="/:ticketId"
        element={
          <AdminTicketContextProvider>
            <PageTitle title="Ticket Details" description="View and manage ticket details" />
            <TicketDetailPage />
          </AdminTicketContextProvider>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
