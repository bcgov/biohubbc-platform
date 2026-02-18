import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { TicketsDashboardPage } from 'features/admin/tickets/TicketsDashboardPage';

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
            <TicketsDashboardPage />
          </>
        }
      />

      <Route
        path="/:ticketId"
        element={
          <>
            <PageTitle title="Ticket Details" description="View and manage ticket details" />
            <TicketDetailPage />
          </>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
