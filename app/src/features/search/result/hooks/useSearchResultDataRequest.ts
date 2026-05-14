import { ICreateDataRequestFormValues } from 'features/data-request/components/form/CreateDataRequestForm';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useIsMounted from 'hooks/useIsMounted';
import { useSerializedAsync } from 'hooks/useSerializedAsync';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useState } from 'react';

interface UseSearchResultDataRequestProps {
  /** Raw feature-type route segment; used to close the create-request dialog on tab change. */
  featureType: string;
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
   * @param {ICreateDataRequestFormValues} values - User-provided reason and collaborator picks.
   * @returns Promise from the serialized create-data-request operation, or `undefined` when another submission is already running.
   */
  const handleCreateDataRequest = useCallback(
    (values: ICreateDataRequestFormValues) =>
      runSerialized(async () => {
        setIsSubmittingDataRequest(true);
        try {
          await api.dataRequest.createDataRequest({
            reason: values.reason,
            system_user_ids: values.system_users.map((user) => user.system_user_id),
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
