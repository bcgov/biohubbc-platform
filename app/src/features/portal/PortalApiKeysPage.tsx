import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IAccessKeyView, ICreateAccessKeyResponse } from 'interfaces/useApiKeysApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { PortalListPageLayout } from './components/PortalListPageLayout';
import { PortalApiKeysContainer } from './list/PortalApiKeysContainer';

/**
 * Portal page for managing user API keys.
 *
 * Handles data loading, client-side search filtering, and create/revoke dialog state.
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<ICreateAccessKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke dialog state
  const [revokeTarget, setRevokeTarget] = useState<IAccessKeyView | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  /** Reset create-dialog state and open the dialog. */
  const handleOpenCreate = () => {
    setNewKeyName('');
    setCreateResult(null);
    setCopied(false);
    setCreateDialogOpen(true);
  };

  /** Close the create dialog and refresh the key list to reflect any newly created key. */
  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setCreateResult(null);
    setNewKeyName('');
    setCopied(false);
    keysLoader.refresh();
  };

  /**
   * Submit a new API key creation request.
   *
   * On success, `createResult` is set so the dialog switches to the one-time plaintext view.
   */
  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      return;
    }
    setIsCreating(true);
    try {
      const result = await api.apiKeys.createApiKey(newKeyName.trim());
      setCreateResult(result);
    } finally {
      setIsCreating(false);
    }
  };

  /** Copy the newly created plaintext key to the clipboard and mark it as copied. */
  const handleCopy = () => {
    if (createResult?.plaintext_key) {
      navigator.clipboard.writeText(createResult.plaintext_key);
      setCopied(true);
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
      await api.apiKeys.revokeApiKey(revokeTarget.access_key_id);
      keysLoader.refresh();
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
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
      />

      {/* Create API Key dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseCreate} maxWidth="sm" fullWidth>
        <DialogTitle>{createResult ? 'API Key Created' : 'Create API Key'}</DialogTitle>
        <DialogContent>
          {createResult ? (
            <Stack spacing={2} mt={1}>
              <DialogContentText color="warning.main" fontWeight="bold">
                Save this key now. It will not be shown again.
              </DialogContentText>
              <OutlinedInput
                value={createResult.plaintext_key}
                readOnly
                fullWidth
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                endAdornment={
                  <InputAdornment position="end">
                    <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                      <IconButton onClick={handleCopy} edge="end" aria-label="copy API key">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                }
              />
              <Typography variant="caption" color="text.secondary">
                Key prefix: <strong>{createResult.access_key.key_prefix}</strong>
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2} mt={1}>
              <DialogContentText>
                Choose a descriptive name so you can identify this key later (e.g. "Parquet download script").
              </DialogContentText>
              <TextField
                autoFocus
                label="Key name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate();
                  }
                }}
                inputProps={{ maxLength: 200 }}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {createResult ? (
            <Button onClick={handleCloseCreate} variant="contained">
              Done
            </Button>
          ) : (
            <>
              <Button
                onClick={handleCreate}
                color="primary"
                variant="contained"
                disabled={!newKeyName.trim() || isCreating}
                startIcon={isCreating ? <CircularProgress size={16} /> : undefined}>
                Create
              </Button>
              <Button onClick={handleCloseCreate} color="primary" variant="outlined">
                Cancel
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

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
    </PortalListPageLayout>
  );
};
