import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminTicketContextProvider } from 'contexts/ticketContext';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { AdminTicketsPage } from 'features/admin2/tickets/AdminTicketsPage';
import { AdminBoardPage } from 'features/admin2/boards/detail/AdminBoardPage';

/**
 * Router for all `/tickets/` pages: the tickets, boards and tags tabs, a board's page and a ticket's page.
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

      {/* A static segment outranks `/:ticketId`, so `boards` is never read as a ticket id. */}
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
