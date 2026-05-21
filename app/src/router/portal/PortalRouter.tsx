import { UserTicketContextProvider } from 'contexts/ticketContext';
import PortalPage from 'features/portal/PortalPage';
import { PortalTicketDetailPage } from 'features/portal/PortalTicketDetailPage';
import { PortalSubmissionDetailPage } from 'features/portal/page/submission/PortalSubmissionDetailPage';
import { PortalSubmissionFeaturePage } from 'features/portal/page/submission/PortalSubmissionFeaturePage';
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

      <Route
        path="/submission"
        element={
          <>
            <PageTitle title="My Submissions" description="View submissions assigned to you" />
            <PortalPage initialTab="submissions" />
          </>
        }
      />

      <Route
        path="/api-key"
        element={
          <>
            <PageTitle title="API Keys" description="Manage your API keys" />
            <PortalPage initialTab="apikeys" />
          </>
        }
      />

      <Route
        path="/ticket/:ticketId"
        element={
          <UserTicketContextProvider>
            <PageTitle title="Ticket Details" description="View ticket details" />
            <PortalTicketDetailPage />
          </UserTicketContextProvider>
        }
      />
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
