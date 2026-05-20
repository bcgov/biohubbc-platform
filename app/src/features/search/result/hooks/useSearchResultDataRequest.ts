import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { CreateDataRequestDialogValues } from 'features/data-request/components/CreateDataRequestDialog';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useState } from 'react';

interface UseSearchResultDataRequestProps {
  /** Canonical feature-type name (already normalized via routeConfig); sent verbatim to the API and used to close the dialog on tab change. */
  featureType: string | undefined;
  /** Expression tree to include in create-data-request submissions. */
  expressionTree: ExpressionTreeExpression | null;
}

/**
 * Owns create-data-request dialog state and submission lifecycle for search results.
 *
 * @param {UseSearchResultDataRequestProps} props - Active feature type and applied expression tree.
 * @returns Create-data-request dialog state and handlers for opening, saving, and canceling.
 */
export const useSearchResultDataRequest = ({ featureType, expressionTree }: UseSearchResultDataRequestProps) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const isMounted = useIsMounted();
  const { runSerialized } = useSerializedAsync();

  const [isCreateDataRequestDialogOpen, setIsCreateDataRequestDialogOpen] = useState(false);
  const [isSubmittingDataRequest, setIsSubmittingDataRequest] = useState(false);

  useEffect(() => {
    setIsCreateDataRequestDialogOpen(false);
  }, [featureType]);

  /**
   * Opens the create-data-request dialog.
   */
  const handleOpenCreateDataRequest = useCallback(() => {
    setIsCreateDataRequestDialogOpen(true);
  }, []);

  /**
   * Submits the create-data-request form for the current expression search.
   * Serialized to prevent duplicate submissions. Success closes the dialog and
   * shows a confirmation snackbar; failure keeps the dialog open and surfaces
   * the API error. State updates are skipped after unmount.
   *
   * @param {CreateDataRequestDialogValues} values - Reason and selected collaborator system user IDs from the dialog.
   * @returns Promise from the serialized create-data-request operation, or `undefined` when another submission is already running.
   */
  const handleCreateDataRequest = useCallback(
    (values: CreateDataRequestDialogValues) =>
      runSerialized(async () => {
        if (!featureType) {
          return undefined;
        }
        setIsSubmittingDataRequest(true);
        try {
          await api.dataRequest.createDataRequest({
            reason: values.reason,
            system_user_ids: values.system_user_ids,
            featureTypes: [featureType],
            expression: expressionTree
          });
          if (!isMounted()) {
            return;
          }
          setIsCreateDataRequestDialogOpen(false);
          dialogContext.setSnackbar({
            open: true,
            snackbarMessage: 'Data request created'
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
            setIsSubmittingDataRequest(false);
          }
        }
      }),
    [api.dataRequest, dialogContext, expressionTree, featureType, runSerialized, isMounted]
  );

  /**
   * Closes the create-data-request dialog without submitting.
   */
  const handleCancelCreateDataRequest = useCallback(() => {
    setIsCreateDataRequestDialogOpen(false);
  }, []);

  return {
    isCreateDataRequestDialogOpen,
    isSubmittingDataRequest,
    handleOpenCreateDataRequest,
    handleCreateDataRequest,
    handleCancelCreateDataRequest
  };
};
