import Box from '@mui/material/Box';
import Button, { ButtonProps } from '@mui/material/Button';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ChangeEvent, ReactNode, useRef } from 'react';

interface ITicketArtifactUploadProps {
  label: string;
  isUploading: boolean;
  disabled?: boolean;
  size: ButtonProps['size'];
  startIcon: ReactNode;
  variant: ButtonProps['variant'];
  onArtifactsSelected: (artifacts: File[]) => Promise<void> | void;
}

/**
 * Shared ticket artifact upload trigger.
 *
 * Renders the upload/attach button, validates selected artifact count against configuration, resets the file input after
 * each selection, and delegates selected artifacts to the caller for the context-specific upload behavior.
 *
 * @param {ITicketArtifactUploadProps} props
 * @return {*}
 */
export const TicketArtifactUpload = (props: ITicketArtifactUploadProps) => {
  const { label, isUploading, disabled, size, startIcon, variant, onArtifactsSelected } = props;
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const artifacts = Array.from(event.target.files ?? []);

    if (artifacts.length > config.MAX_UPLOAD_NUM_FILES) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Number of artifacts selected at once exceeds maximum'
      });
      event.target.value = '';
      return;
    }

    await onArtifactsSelected(artifacts);
    event.target.value = '';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Button
        aria-label={label}
        color="primary"
        disabled={disabled || isUploading}
        loading={isUploading}
        onClick={() => {
          fileInputRef.current?.click();
        }}
        size={size}
        startIcon={startIcon}
        variant={variant}>
        {label}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        disabled={disabled || isUploading}
        onChange={handleFileSelection}
        aria-label={`${label} file input`}
      />
    </Box>
  );
};
