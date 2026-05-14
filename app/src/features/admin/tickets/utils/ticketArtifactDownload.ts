import { IDialogContext } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { ITicketArtifact, ITicketArtifactDownloadResponse } from 'interfaces/useTicketsApi.interface';

interface IDownloadTicketArtifactParams {
  ticketId: string;
  artifact: ITicketArtifact;
  getDownloadUrl: (ticketId: string, ticketArtifactId: string) => Promise<ITicketArtifactDownloadResponse>;
  setSnackbar: IDialogContext['setSnackbar'];
}

/**
 * Open a ticket artifact in a new browser tab using a short-lived signed URL.
 *
 * @param {IDownloadTicketArtifactParams} params Download parameters.
 * @returns {Promise<void>} Resolves after the tab is redirected or an error snackbar is shown.
 */
export const downloadTicketArtifact = async (params: IDownloadTicketArtifactParams) => {
  const { ticketId, artifact, getDownloadUrl, setSnackbar } = params;
  const artifactWindow = window.open('', '_blank');

  if (artifactWindow) {
    artifactWindow.opener = null;
  }

  try {
    const response = await getDownloadUrl(ticketId, artifact.ticket_artifact_id);

    if (!artifactWindow) {
      setSnackbar({
        open: true,
        snackbarMessage: 'Unable to open attachment. Please allow pop-ups for this site.'
      });
      return;
    }

    artifactWindow.location.href = response.signed_url;
  } catch (caughtError) {
    artifactWindow?.close();

    const apiError = caughtError as APIError;
    setSnackbar({
      open: true,
      snackbarMessage: apiError.message || 'Failed to download attachment.'
    });
  }
};
