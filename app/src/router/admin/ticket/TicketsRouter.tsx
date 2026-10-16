import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { AdminTicketContextProvider } from 'contexts/ticketContext';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { AdminTicketsPage } from 'features/admin2/tickets/AdminTicketsPage';

/**
 * Router for all `/tickets/` pages.
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
