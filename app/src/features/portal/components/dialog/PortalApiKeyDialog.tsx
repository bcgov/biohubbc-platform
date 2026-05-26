import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { EditDialog } from 'components/dialog/EditDialog';
import { OkDialog } from 'components/dialog/OkDialog';
import { ICreateApiKeyResponse } from 'interfaces/useApiKeysApi.interface';
import { useEffect, useState } from 'react';
import { ApiKeyForm, IApiKeyFormValues } from './ApiKeyForm';
import { ApiKeyYupSchema } from './ApiKeyYupSchema';

const createFormInitialValues: IApiKeyFormValues = {
  name: ''
};

interface IPortalApiKeyDialogProps {
  open: boolean;
  isLoading: boolean;
  onCancel: () => void;
  onSave: (values: IApiKeyFormValues) => Promise<ICreateApiKeyResponse | void>;
}

/**
 * Two-phase create dialog for API keys: EditDialog for name entry, OkDialog for one-time plaintext display.
 */
export const PortalApiKeyDialog = (props: IPortalApiKeyDialogProps) => {
  const { open, isLoading, onCancel, onSave } = props;

  const [createdResult, setCreatedResult] = useState<ICreateApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreatedResult(null);
      setCopied(false);
    }
  }, [open]);

  const handleSave = async (values: IApiKeyFormValues) => {
    const result = await onSave(values);

    if (result) {
      setCreatedResult(result);
    }
  };

  const handleCopy = () => {
    if (createdResult?.plaintext_key) {
      navigator.clipboard.writeText(createdResult.plaintext_key);
      setCopied(true);
    }
  };

  const handleCloseSuccess = () => {
    setCreatedResult(null);
    setCopied(false);
    onCancel();
  };

  return (
    <>
      <EditDialog<IApiKeyFormValues>
        open={open && !createdResult}
        isLoading={isLoading}
        maxWidth="sm"
        dialogTitle="New API Key"
        dialogSaveButtonLabel="Create"
        component={{
          element: <ApiKeyForm />,
          initialValues: createFormInitialValues,
          validationSchema: ApiKeyYupSchema
        }}
        onCancel={onCancel}
        onSave={handleSave}
      />

      <OkDialog
        open={!!createdResult}
        dialogTitle="API Key Created"
        dialogText="Save this key now. It will not be shown again."
        okButtonLabel="Done"
        onClose={handleCloseSuccess}
        dialogProps={{ maxWidth: 'sm', fullWidth: true }}
        dialogContent={
          createdResult ? (
            <Stack spacing={2} mt={1}>
              <OutlinedInput
                value={createdResult.plaintext_key}
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
                Key prefix: <strong>{createdResult.api_key.key_prefix}</strong>
              </Typography>
            </Stack>
          ) : undefined
        }
      />
    </>
  );
};
