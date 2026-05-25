import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { useCallback, useEffect, useState } from 'react';
import { DownloadUrlDisplay } from '../components/DownloadUrlDisplay';
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
  const { auth } = useAuthStateContext();
  const { checkout } = useCartContext();
  const dialogContext = useDialogContext();
  const isMounted = useIsMounted();
  const { runSerialized } = useSerializedAsync();

  const [downloadView, setDownloadView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);
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
   * Downloads sidebar with a success snackbar, while anonymous users get a
   * persistent dialog carrying their export status URL. Failure keeps the
   * dialog open and shows the API error. State updates are skipped after unmount.
   *
   * @param {ICreateDownloadFormValues} values - User-provided download name, description, and feature types.
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
            featureTypes: values.featureTypes,
            expression: expressionTree
          });
          if (!isMounted()) {
            return;
          }
          setIsCreateDownloadDialogOpen(false);
          if (auth.isAuthenticated) {
            setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
            dialogContext.setSnackbar({
              open: true,
              snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
            });
          } else {
            // Anonymous users have no Downloads sidebar; the returned export status URL is their
            // only credential, so it is surfaced in a persistent dialog rather than a transient snackbar.
            dialogContext.setOkDialog({
              open: true,
              dialogTitle: 'Download created',
              dialogText:
                'Your download is being prepared. Use this URL to check its status and get download links when ready.',
              dialogContent: <DownloadUrlDisplay url={response.export_url ?? ''} />,
              onClose: () => dialogContext.setOkDialog({ open: false })
            });
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
    [api.download, auth.isAuthenticated, dialogContext, expressionTree, runSerialized, isMounted]
  );

  /**
   * Checks out the current cart and moves the sidebar to the Downloads view.
   * Checkout failures are surfaced through the global snackbar.
   */
  const handleCheckout = useCallback(async () => {
    try {
      await checkout();
      setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [checkout, dialogContext]);

  /**
   * Closes the create-download dialog without submitting.
   * Does not reset expression, sidebar tab, or pagination state.
   */
  const handleCancelCreateDownload = useCallback(() => {
    setIsCreateDownloadDialogOpen(false);
  }, []);

  return {
    downloadView,
    setDownloadView,
    isCreateDownloadDialogOpen,
    isSubmittingDownload,
    handleOpenCreateDownload,
    handleCreateDownload,
    handleCancelCreateDownload,
    handleCheckout
  };
};
