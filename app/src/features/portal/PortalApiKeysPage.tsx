import YesNoDialog from 'components/dialog/YesNoDialog';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IApiKeyView } from 'interfaces/useApiKeysApi.interface';
import { useEffect, useMemo, useState } from 'react';
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

  const keysLoader = useDataLoader(api.apiKeys.listApiKeys);

  useEffect(() => {
    keysLoader.load();
  }, [keysLoader]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredKeys = useMemo(() => {
    const allKeys = keysLoader.data ?? [];
    if (!searchTerm.trim()) {
      return allKeys;
    }
    const lower = searchTerm.toLowerCase();
    return allKeys.filter(
      (key) => key.name.toLowerCase().includes(lower) || key.key_prefix.toLowerCase().includes(lower)
    );
  }, [keysLoader.data, searchTerm]);

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Revoke dialog state
  const [revokeTarget, setRevokeTarget] = useState<IApiKeyView | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<IApiKeyView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Reset create-dialog state and open the dialog. */
  const handleOpenCreate = () => {
    setIsCreateDialogOpen(true);
  };

  /** Close the create dialog and refresh the key list to reflect any newly created key. */
  const handleCloseCreate = () => {
    setIsCreateDialogOpen(false);
    keysLoader.refresh();
  };

  /**
   * Submit a new API key creation request.
   *
   * Returns the create response so `PortalApiKeyDialog` can show the one-time plaintext key.
   */
  const handleCreateSave = async (values: IApiKeyFormValues) => {
    setIsCreating(true);
    try {
      return await api.apiKeys.createApiKey(values.name.trim());
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Confirm revocation of `revokeTarget` and refresh the key list.
   *
   * The revoke button is disabled while the request is in flight to prevent double-submission.
   */
  const handleRevokeConfirm = async () => {
    if (!revokeTarget) {
      return;
    }
    setIsRevoking(true);
    try {
      await api.apiKeys.revokeApiKey(revokeTarget.api_key_id);
      keysLoader.refresh();
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
  };

  /**
   * Confirm deletion of `deleteTarget` and refresh the key list.
   *
   * The delete button is disabled while the request is in flight to prevent double-submission.
   */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.apiKeys.deleteApiKey(deleteTarget.api_key_id);
      keysLoader.refresh();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <PortalListPageLayout>
      <PortalApiKeysContainer
        rows={filteredKeys}
        rowCount={filteredKeys.length}
        isLoading={keysLoader.isLoading}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onAdd={handleOpenCreate}
        onRevoke={setRevokeTarget}
        onDelete={setDeleteTarget}
      />

      {/* New API Key dialog */}
      <PortalApiKeyDialog
        open={isCreateDialogOpen}
        isLoading={isCreating}
        onCancel={handleCloseCreate}
        onSave={handleCreateSave}
      />

      {/* Revoke confirmation dialog */}
      <YesNoDialog
        open={!!revokeTarget}
        dialogTitle="Revoke API Key"
        dialogText={`Are you sure you want to revoke "${revokeTarget?.name}"? This will immediately stop all requests using this key and cannot be undone.`}
        yesButtonLabel="Revoke"
        yesButtonProps={{ color: 'error', variant: 'contained', disabled: isRevoking }}
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
        yesButtonProps={{ color: 'error', variant: 'contained', disabled: isDeleting }}
        noButtonLabel="Cancel"
        onClose={() => setDeleteTarget(null)}
        onNo={() => setDeleteTarget(null)}
        onYes={handleDeleteConfirm}
      />
    </PortalListPageLayout>
  );
};
