import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiPaginationResponseParams } from 'types/pagination';
import { ICreateDownloadFormValues } from '../sidebar/download/CreateDownloadForm';

interface UseSearchResultDownloadProps {
  /** Raw feature-type route segment; used to close route-scoped dialogs when it changes. */
  featureType: string | undefined;
  /** Expression tree to include in create-download requests. */
  expressionTree: ExpressionTreeExpression | null;
  /** Whether result data is currently loading. */
  isLoading: boolean;
  /** Result pagination metadata; undefined while initial results are pending. */
  pagination: ApiPaginationResponseParams | undefined;
}

/**
 * Owns download sidebar state and create-download lifecycle for search results.
 *
 * Keeps download-specific behavior out of the route component: active sidebar
 * tab, create-download dialog state, checkout, and expression-backed download
 * creation. Guards against empty searches and stale in-flight result state.
 *
 * @param {UseSearchResultDownloadProps} props - Route, expression, loading, and pagination state needed by download actions.
 * @returns Download sidebar state, create-download dialog state, and handlers for opening, saving, canceling, and checkout.
 */
export const useSearchResultDownload = ({
  featureType,
  expressionTree,
  isLoading,
  pagination
}: UseSearchResultDownloadProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const { auth } = useAuthStateContext();
  const dialogContext = useDialogContext();
  const isMounted = useIsMounted();
  const { runSerialized } = useSerializedAsync();

  const [isCreateDownloadDialogOpen, setIsCreateDownloadDialogOpen] = useState(false);
  const [isSubmittingDownload, setIsSubmittingDownload] = useState(false);

  useEffect(() => {
    setIsCreateDownloadDialogOpen(false);
  }, [featureType]);

  /**
   * Opens the create-download dialog for the currently applied search.
   * Waits for pagination before deciding whether to open the form or show the
   * zero-results dialog.
   */
  const handleOpenCreateDownload = useCallback(() => {
    if (isLoading || pagination === undefined) {
      return;
    }

    if (pagination.total === 0) {
      dialogContext.setOkDialog({
        open: true,
        dialogTitle: 'Create Download',
        dialogText: 'There are no features matching your current search to download.',
        onClose: () => dialogContext.setOkDialog({ open: false })
      });
      return;
    }

    setIsCreateDownloadDialogOpen(true);
  }, [isLoading, pagination, dialogContext]);

  /**
   * Submits the create-download form for the current expression search.
   * Serialized to prevent duplicate downloads. On success the dialog closes and
   * the outcome branches on authentication: authenticated users switch to the
   * Downloads sidebar with a success snackbar, while anonymous users are
   * navigated to the public download page at `/download/:downloadId`, where they
   * can monitor status and obtain their export. Failure keeps the dialog open
   * and shows the API error. State updates are skipped after unmount.
   *
   * @param {ICreateDownloadFormValues} values - User-provided download name and description.
   * @returns Promise from the serialized create-download operation, or `undefined` when another submission is already running.
   */
  const handleCreateDownload = useCallback(
    (values: ICreateDownloadFormValues) =>
      runSerialized(async () => {
        setIsSubmittingDownload(true);
        try {
          const response = await api.download.createDownload({
            name: values.name,
            description: values.description,
            expression: expressionTree
          });
          if (!isMounted()) {
            return;
          }
          setIsCreateDownloadDialogOpen(false);
          if (auth.isAuthenticated) {
            dialogContext.setSnackbar({
              open: true,
              snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
            });
          } else {
            navigate(`/download/${response.download_id}`);
          }
        } catch (error) {
          if (!isMounted()) {
            return;
          }
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: (error as APIError).message
          });
        } finally {
          if (isMounted()) {
            setIsSubmittingDownload(false);
          }
        }
      }),
    [api.download, auth.isAuthenticated, dialogContext, expressionTree, navigate, runSerialized, isMounted]
  );

  /**
   * Closes the create-download dialog without submitting.
   * Does not reset expression or pagination state.
   */
  const handleCancelCreateDownload = useCallback(() => {
    setIsCreateDownloadDialogOpen(false);
  }, []);

  return {
    downloadView: 'Downloads',
    isCreateDownloadDialogOpen,
    isSubmittingDownload,
    handleOpenCreateDownload,
    handleCreateDownload,
    handleCancelCreateDownload
  };
};
