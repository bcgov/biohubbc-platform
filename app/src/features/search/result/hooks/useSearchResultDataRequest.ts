import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { CreateDataRequestDialogValues } from 'features/data-request/components/CreateDataRequestDialog';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useId, useState } from 'react';

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
  const { auth } = useAuthStateContext();
  const dialogContext = useDialogContext();
  const queryClient = useQueryClient();
  // Scopes the in-flight check below to this hook instance.
  const createDataRequestMutationKey = ['search-result', 'create-data-request', useId()];
  const createDataRequestMutation = useMutation({
    mutationKey: createDataRequestMutationKey,
    mutationFn: ({ values, featureTypeName }: { values: CreateDataRequestDialogValues; featureTypeName: string }) =>
      api.dataRequest.createDataRequest({
        reason: values.reason,
        system_user_ids: values.system_user_ids,
        featureTypes: [featureTypeName],
        expression: expressionTree
      })
  });
  const { mutate: createDataRequest } = createDataRequestMutation;

  const [isCreateDataRequestDialogOpen, setIsCreateDataRequestDialogOpen] = useState(false);

  useEffect(() => {
    setIsCreateDataRequestDialogOpen(false);
  }, [featureType]);

  /**
   * Opens the create-data-request dialog for authenticated users.
   *
   * The data-request flow requires an authenticated BioHub user. When the caller
   * is unauthenticated they are redirected to the Keycloak login page. The current
   * search location (path + query string, which includes the encoded `expr` search
   * expression) is carried through the OIDC `state` param — not a dynamic
   * `redirect_uri`, which prod SSO rejects as a wildcard URI — so the post-login
   * callback can restore the search results.
   */
  const handleOpenCreateDataRequest = useCallback(() => {
    if (!auth.isAuthenticated) {
      const returnTo = `${globalThis.location.pathname}${globalThis.location.search}`;
      auth.signinRedirect({ state: { returnTo } });
      return;
    }
    setIsCreateDataRequestDialogOpen(true);
  }, [auth]);

  /**
   * Submits the create-data-request form for the current expression search.
   * Ignored while a submission from this hook is in flight, so a double submit creates one request. Success closes
   * the dialog and shows a confirmation snackbar; failure keeps the dialog open and surfaces the API error. Neither
   * runs once the page has unmounted.
   *
   * @param {CreateDataRequestDialogValues} values - Reason and selected collaborator system user IDs from the dialog.
   * @returns {void}
   */
  const handleCreateDataRequest = (values: CreateDataRequestDialogValues) => {
    if (!featureType || queryClient.isMutating({ mutationKey: createDataRequestMutationKey }) > 0) {
      return;
    }

    createDataRequest(
      { values, featureTypeName: featureType },
      {
        onSuccess: () => {
          setIsCreateDataRequestDialogOpen(false);
          dialogContext.setSnackbar({ open: true, snackbarMessage: 'Data request created' });
        },
        onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
      }
    );
  };

  /**
   * Closes the create-data-request dialog without submitting.
   */
  const handleCancelCreateDataRequest = useCallback(() => {
    setIsCreateDataRequestDialogOpen(false);
  }, []);

  return {
    isCreateDataRequestDialogOpen,
    isSubmittingDataRequest: createDataRequestMutation.isPending,
    handleOpenCreateDataRequest,
    handleCreateDataRequest,
    handleCancelCreateDataRequest
  };
};
