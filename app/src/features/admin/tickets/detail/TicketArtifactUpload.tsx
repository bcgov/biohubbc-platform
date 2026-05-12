import { mdiPaperclip } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ChangeEvent, useRef } from 'react';

interface ITicketArtifactUploadProps {
  label: string;
  isUploading: boolean;
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
  const { label, isUploading, onArtifactsSelected } = props;
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
        loading={isUploading}
        onClick={() => {
          fileInputRef.current?.click();
        }}
        size="small"
        startIcon={<Icon path={mdiPaperclip} size={0.75} />}
        variant="contained">
        {label}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileSelection}
        aria-label={`${label} file input`}
      />
    </Box>
  );
};
