import { PORTAL_DOWNLOAD_BASE_PATH } from 'constants/download';
import { UserTicketContextProvider } from 'contexts/ticketContext';
import { DownloadPage } from 'features/download/DownloadPage';
import { DownloadVersionPage } from 'features/download/DownloadVersionPage';
import { PortalApiKeysPage } from 'features/portal/api-keys/PortalApiKeysPage';
import { PortalDataRequestsPage } from 'features/portal/data-requests/PortalDataRequestsPage';
import { PortalDownloadsPage } from 'features/portal/downloads/PortalDownloadsPage';
import { PortalPage } from 'features/portal/PortalPage';
import { PortalSubmissionsPage } from 'features/portal/submissions/PortalSubmissionsPage';
import { PortalSubmissionDetailPage } from 'features/portal/submissions/detail/PortalSubmissionDetailPage';
import { PortalSubmissionFeaturePage } from 'features/portal/submissions/detail/feature/PortalSubmissionFeaturePage';
import { PortalSubmissionUploadPage } from 'features/portal/submissions/detail/upload/PortalSubmissionUploadPage';
import { PortalTicketsPage } from 'features/portal/tickets/PortalTicketsPage';
import { PortalTicketDetailPage } from 'features/portal/tickets/detail/PortalTicketDetailPage';
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
            <PageTitle title="Portal" description="Browse portal sections" />
            <PortalPage />
          </>
        }
      />

      <Route
        path="/ticket"
        element={
          <>
            <PageTitle title="My Tickets" description="View tickets assigned to you" />
            <PortalTicketsPage />
          </>
        }
      />

      <Route
        path="/submission"
        element={
          <>
            <PageTitle title="My Submissions" description="View submissions assigned to you" />
            <PortalSubmissionsPage />
          </>
        }
      />

      <Route
        path="/download"
        element={
          <>
            <PageTitle title="My Downloads" description="View downloads available to you" />
            <PortalDownloadsPage />
          </>
        }
      />

      <Route
        path="/download/:downloadId"
        element={
          <>
            <PageTitle title="Download" description="Download status and details" />
            <DownloadPage basePath={PORTAL_DOWNLOAD_BASE_PATH} />
          </>
        }
      />

      <Route
        path="/download/:downloadId/version/:downloadVersionId"
        element={
          <>
            <PageTitle title="Download" description="Download version details" />
            <DownloadVersionPage basePath={PORTAL_DOWNLOAD_BASE_PATH} />
          </>
        }
      />

      <Route
        path="/data-request"
        element={
          <>
            <PageTitle title="My Data Requests" description="View data requests made for your teams" />
            <PortalDataRequestsPage />
          </>
        }
      />

      <Route
        path="/api-key"
        element={
          <>
            <PageTitle title="API Keys" description="Manage your API keys" />
            <PortalApiKeysPage />
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
      <Route
        path="/submission/:submissionId/upload/:submissionUploadId"
        element={
          <>
            <PageTitle title="Submission Upload" description="View the features of a submission upload" />
            <PortalSubmissionUploadPage />
          </>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
