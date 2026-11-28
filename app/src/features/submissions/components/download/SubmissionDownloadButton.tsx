import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { useMutation } from '@tanstack/react-query';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { DOWNLOAD_BASE_PATH, PORTAL_DOWNLOAD_BASE_PATH } from 'constants/download';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { useNavigate } from 'react-router-dom';

interface SubmissionDownloadButtonProps {
  /** Submission whose features are downloaded. */
  submissionId: number;
}

/**
 * Creates a download of every feature in a submission and opens its download page.
 *
 * The download is named after the submission and holds the same features as an unfiltered search limited to it,
 * filtered for what the user can see. A signed-in user's download is claimed by their team as it is created, so it
 * opens under the portal; an anonymous download opens on the public page, where its UUID is the credential. The
 * button shows its progress while the download is created and is ignored until that finishes, so a double click
 * creates one download. A failure shows the API error.
 *
 * @param {SubmissionDownloadButtonProps} props - The submission to download.
 * @returns {JSX.Element} The submission's Download button.
 */
export const SubmissionDownloadButton = ({ submissionId }: SubmissionDownloadButtonProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const dialogContext = useDialogContext();
  const { auth } = useAuthStateContext();

  const createSubmissionDownloadMutation = useMutation({
    mutationFn: () => api.download.createSubmissionDownload(submissionId),
    onSuccess: (response) => {
      if (auth.isAuthenticated) {
        navigate(`${PORTAL_DOWNLOAD_BASE_PATH}/${response.download_id}`);
        return;
      }

      navigate(`${DOWNLOAD_BASE_PATH}/${response.download_id}`);
    },
    onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

  return (
    <PrimaryButton
      size="small"
      startIcon={<Icon path={mdiDownload} size={0.8} />}
      loading={createSubmissionDownloadMutation.isPending}
      onClick={() => createSubmissionDownloadMutation.mutate()}
      data-testid="submission-download-button">
      Download
    </PrimaryButton>
  );
};
