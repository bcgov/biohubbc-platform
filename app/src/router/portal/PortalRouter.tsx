import { UserTicketContextProvider } from 'contexts/ticketContext';
import PortalPage from 'features/portal/PortalPage';
import { PortalTicketDetailPage } from 'features/portal/PortalTicketDetailPage';
import { PortalSubmissionDetailPage } from 'features/portal/page/submission/PortalSubmissionDetailPage';
import { PortalSubmissionFeaturePage } from 'features/portal/page/submission/PortalSubmissionFeaturePage';
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
      <Route
        path="/"
        element={
          <>
            <PageTitle title="My Portal" description="View portal activity" />
            <PortalPage />
          </>
        }
      />

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
        path="/submission"
        element={
          <>
            <PageTitle title="My Submissions" description="View submissions assigned to you" />
            <PortalPage initialTab="submissions" />
          </>
        }
      />
      <Route path="/submissions" element={<Navigate to="/portal/submission" replace />} />

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
      <Route
        path="/submission/:submissionId"
        element={
          <>
            <PageTitle title="Submission Details" description="View submission details" />
            <PortalSubmissionDetailPage />
          </>
        }
      />
      <Route
        path="/submission/:submissionId/feature/:submissionFeatureId"
        element={
          <>
            <PageTitle title="Submission Feature Details" description="View submission feature details" />
            <PortalSubmissionFeaturePage />
          </>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
