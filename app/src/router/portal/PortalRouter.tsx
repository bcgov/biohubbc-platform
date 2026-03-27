import { TicketContextProvider } from 'contexts/ticketContext';
import { TicketDetailPage } from 'features/admin/tickets/TicketDetailPage';
import { PortalTicketsPage } from 'features/portal/PortalTicketsPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/portal/` pages.
 *
 * @return {*}
 */
export const PortalRouter = () => {
  return (
    <Routes>
      {/* Default redirect to tickets */}
      <Route path="/" element={<Navigate to="/portal/tickets" replace />} />

      <Route
        path="/tickets"
        element={
          <>
            <PageTitle title="My Tickets" description="View tickets assigned to you" />
            <PortalTicketsPage />
          </>
        }
      />

      <Route
        path="/tickets/:ticketId"
        element={
          <TicketContextProvider>
            <PageTitle title="Ticket Details" description="View ticket details" />
            <TicketDetailPage />
          </TicketContextProvider>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
