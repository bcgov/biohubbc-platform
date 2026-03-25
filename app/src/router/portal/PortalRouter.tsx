import { UserTicketContextProvider } from 'contexts/ticketContext';
import PortalPage from 'features/portal/PortalPage';
import { PortalTicketDetailPage } from 'features/portal/PortalTicketDetailPage';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

const LegacyPortalTicketDetailRedirect = () => {
  const { ticketId } = useParams<{ ticketId: string }>();

  if (!ticketId) {
    return <Navigate to="/portal/ticket" replace />;
  }

  return <Navigate to={`/portal/ticket/${ticketId}`} replace />;
};

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
        path="/ticket"
        element={
          <>
            <PageTitle title="My Tickets" description="View tickets assigned to you" />
            <PortalPage initialTab="tickets" />
          </>
        }
      />
      <Route path="/tickets" element={<Navigate to="/portal/ticket" replace />} />

      <Route
        path="/ticket/:ticketId"
        element={
          <UserTicketContextProvider>
            <PageTitle title="Ticket Details" description="View ticket details" />
            <PortalTicketDetailPage />
          </UserTicketContextProvider>
        }
      />
      <Route path="/tickets/:ticketId" element={<LegacyPortalTicketDetailRedirect />} />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
