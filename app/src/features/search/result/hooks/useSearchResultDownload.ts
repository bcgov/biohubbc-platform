import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useCartContext, useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { useCallback, useEffect, useState } from 'react';
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
 * Use this hook from `SearchResultPage` to keep download-specific behavior out
 * of the route component. It manages the active sidebar tab, create-download
 * dialog open/submitting state, checkout behavior for the cart tab, and creation
 * of expression-backed downloads. It also guards against empty searches and
 * stale in-flight result state before opening the create-download dialog.
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
   *
   * Use this as the result panel's "Create Download" action. It intentionally
   * does nothing while result pagination is still loading, because the page does
   * not yet know whether there are downloadable features. If the current search
   * has zero results, it shows an informational dialog instead of opening the
   * form.
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
   *
   * Use this as `CreateDownloadDialog.onSave`. The operation is serialized so a
   * double-click or repeated submit cannot create duplicate downloads. On
   * success it closes the dialog, switches the sidebar to the Downloads tab, and
   * shows a snackbar. On failure it keeps the dialog open and surfaces the API
   * error message. State updates are skipped if the component unmounts before
   * the request resolves.
   *
   * @param {ICreateDownloadFormValues} values - User-provided download name, description, and feature types.
   * @returns Promise from the serialized create-download operation, or `undefined` when another submission is already running.
   */
  const handleCreateDownload = useCallback(
    (values: ICreateDownloadFormValues) =>
      runSerialized(async () => {
        setIsSubmittingDownload(true);
        try {
          await api.download.createDownload({
            name: values.name,
            description: values.description,
            featureTypes: values.featureTypes,
            expression: expressionTree
          });
          if (!isMounted()) {
            return;
          }
          setIsCreateDownloadDialogOpen(false);
          setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
          });
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
    [api.download, dialogContext, expressionTree, runSerialized, isMounted]
  );

  /**
   * Checks out the current cart and moves the sidebar to the Downloads view.
   *
   * Use this as the download sidebar checkout action. Cart checkout owns the
   * selected cart contents; this handler only coordinates the sidebar transition
   * and snackbar error reporting for failed checkout attempts.
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
   *
   * Use this as `CreateDownloadDialog.onCancel`. It only updates local dialog
   * state; it does not reset the current expression, sidebar tab, or result
   * pagination.
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
