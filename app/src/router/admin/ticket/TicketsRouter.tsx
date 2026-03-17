import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { TicketContextProvider } from 'contexts/ticketContext';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { TicketsPage } from 'features/admin/tickets/TicketsPage';

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
            <PageTitle title="Administrative" description="Browse and manage administrative tickets" />
            <TicketsPage />
          </>
        }
      />

      <Route
        path="/:ticketId"
        element={
          <TicketContextProvider>
            <PageTitle title="Ticket Details" description="View and manage ticket details" />
            <TicketDetailPage />
          </TicketContextProvider>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
