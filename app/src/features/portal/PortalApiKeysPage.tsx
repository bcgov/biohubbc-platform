import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IApiKeyView } from 'interfaces/useApiKeysApi.interface';
import { useMemo, useState } from 'react';
import { apiKeyQueryKeys } from 'utils/query-keys/api-key-query-keys';
import { IApiKeyFormValues } from './components/dialog/ApiKeyForm';
import { PortalApiKeyDialog } from './components/dialog/PortalApiKeyDialog';
import { PortalListPageLayout } from './components/PortalListPageLayout';
import { PortalApiKeysContainer } from './list/PortalApiKeysContainer';

/**
 * Portal page for managing user API keys.
 *
 * Handles data loading, client-side search filtering, and create/revoke/delete dialog state.
 * Delegates all layout and table rendering to PortalApiKeysContainer.
 */
export const PortalApiKeysPage = () => {
  const api = useApi();
  const { setOkDialog } = useDialogContext();
  const queryClient = useQueryClient();

  const keysQuery = useQuery({
    queryKey: apiKeyQueryKeys.mine(),
    queryFn: ({ signal }) => api.apiKeys.listApiKeys({ signal })
  });

  /**
   * Reloads the key list, so it reflects a key created, revoked or deleted.
   *
   * @returns {Promise<void>} Resolves after the visible key list refreshes.
   */
  const refreshKeys = () => queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.mine() });

  const [searchTerm, setSearchTerm] = useState('');

  const filteredKeys = useMemo(() => {
    const allKeys = keysQuery.data ?? [];
    if (!searchTerm.trim()) {
      return allKeys;
    }
    const lower = searchTerm.toLowerCase();
    return allKeys.filter(
      (key) => key.name.toLowerCase().includes(lower) || key.key_prefix.toLowerCase().includes(lower)
    );
  }, [keysQuery.data, searchTerm]);

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const createMutation = useMutation({
    mutationFn: (name: string) => api.apiKeys.createApiKey(name),
    onSuccess: refreshKeys
  });

  // Revoke dialog state
  const [revokeTarget, setRevokeTarget] = useState<IApiKeyView | null>(null);
  const revokeMutation = useMutation({
    mutationFn: (apiKeyId: IApiKeyView['api_key_id']) => api.apiKeys.revokeApiKey(apiKeyId),
    onError: (error) => {
      setOkDialog({
        open: true,
        dialogTitle: 'Failed to revoke API key',
        dialogText: error.message,
        dialogProps: { maxWidth: 'sm' },
        onClose: () => setOkDialog({ open: false })
      });
    },
    onSuccess: async () => {
      await refreshKeys();
      setRevokeTarget(null);
    }
  });

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<IApiKeyView | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (apiKeyId: IApiKeyView['api_key_id']) => api.apiKeys.deleteApiKey(apiKeyId),
    onError: (error) => {
      setOkDialog({
        open: true,
        dialogTitle: 'Failed to delete API key',
        dialogText: error.message,
        dialogProps: { maxWidth: 'sm' },
        onClose: () => setOkDialog({ open: false })
      });
    },
    onSuccess: async () => {
      await refreshKeys();
      setDeleteTarget(null);
    }
  });

  /** Reset create-dialog state and open the dialog. */
  const handleOpenCreate = () => {
    setIsCreateDialogOpen(true);
  };

  /** Close the create dialog. */
  const handleCloseCreate = () => {
    setIsCreateDialogOpen(false);
  };

  /**
   * Submit a new API key creation request.
   *
   * Returns the create response so `PortalApiKeyDialog` can show the one-time plaintext key.
   *
   * @param {IApiKeyFormValues} values The key name entered.
   * @returns The created key, including its one-time plaintext value.
   */
  const handleCreateSave = (values: IApiKeyFormValues) => createMutation.mutateAsync(values.name.trim());

  /**
   * Confirm revocation of `revokeTarget`; the list reloads once it is revoked.
   *
   * The revoke button is disabled while the request is in flight to prevent double-submission.
   */
  const handleRevokeConfirm = () => {
    if (revokeTarget) {
      revokeMutation.mutate(revokeTarget.api_key_id);
    }
  };

  /**
   * Confirm deletion of `deleteTarget`; the list reloads once it is deleted.
   *
   * The delete button is disabled while the request is in flight to prevent double-submission.
   */
  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.api_key_id);
    }
  };

  return (
    <PortalListPageLayout>
      <QueryErrorDialog error={keysQuery.error} label="API keys" />
      <PortalApiKeysContainer
        rows={filteredKeys}
        rowCount={filteredKeys.length}
        isLoading={keysQuery.isFetching}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onAdd={handleOpenCreate}
        onRevoke={(key) => {
          revokeMutation.reset();
          setRevokeTarget(key);
        }}
        onDelete={(key) => {
          deleteMutation.reset();
          setDeleteTarget(key);
        }}
      />

      {/* New API Key dialog */}
      <PortalApiKeyDialog
        open={isCreateDialogOpen}
        isLoading={createMutation.isPending}
        onCancel={handleCloseCreate}
        onSave={handleCreateSave}
      />

      {/* Revoke confirmation dialog */}
      <YesNoDialog
        open={!!revokeTarget}
        dialogTitle="Revoke API Key"
        dialogText={`Are you sure you want to revoke "${revokeTarget?.name}"? This will immediately stop all requests using this key and cannot be undone.`}
        yesButtonLabel="Revoke"
        yesButtonProps={{ color: 'error', variant: 'contained', disabled: revokeMutation.isPending }}
        noButtonLabel="Cancel"
        onClose={() => setRevokeTarget(null)}
        onNo={() => setRevokeTarget(null)}
        onYes={handleRevokeConfirm}
      />

      {/* Delete confirmation dialog */}
      <YesNoDialog
        open={!!deleteTarget}
        dialogTitle="Delete API Key"
        dialogText={`Are you sure you want to delete "${deleteTarget?.name}"? The key will be permanently removed from your list and immediately invalidated.`}
        yesButtonLabel="Delete"
        yesButtonProps={{ color: 'error', variant: 'contained', disabled: deleteMutation.isPending }}
        noButtonLabel="Cancel"
        onClose={() => setDeleteTarget(null)}
        onNo={() => setDeleteTarget(null)}
        onYes={handleDeleteConfirm}
      />
    </PortalListPageLayout>
  );
};
