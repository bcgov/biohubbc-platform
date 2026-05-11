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

  const handleCheckout = useCallback(async () => {
    try {
      await checkout();
      setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [checkout, dialogContext]);

  return {
    downloadView,
    setDownloadView,
    isCreateDownloadDialogOpen,
    isSubmittingDownload,
    handleOpenCreateDownload,
    handleCreateDownload,
    handleCancelCreateDownload: () => setIsCreateDownloadDialogOpen(false),
    handleCheckout
  };
};
