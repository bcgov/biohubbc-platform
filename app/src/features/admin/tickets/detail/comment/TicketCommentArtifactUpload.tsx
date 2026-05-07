import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button, { ButtonProps } from '@mui/material/Button';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ChangeEvent, CSSProperties, useRef } from 'react';

interface ITicketCommentArtifactUploadProps {
  label: string;
  buttonAriaLabel: string;
  inputAriaLabel: string;
  iconPath: string;
  iconSize?: number;
  iconStyle?: CSSProperties;
  isUploading: boolean;
  buttonProps?: Pick<ButtonProps, 'color' | 'disabled' | 'size' | 'variant'>;
  onArtifactsSelected: (artifacts: File[]) => Promise<void> | void;
}

/**
 * Shared ticket artifact upload trigger.
 *
 * Renders the upload/attach button, validates selected artifact count against configuration, resets the file input after
 * each selection, and delegates selected artifacts to the caller for the context-specific upload behavior.
 *
 * @param {ITicketCommentArtifactUploadProps} props
 * @return {*}
 */
export const TicketCommentArtifactUpload = (props: ITicketCommentArtifactUploadProps) => {
  const {
    label,
    buttonAriaLabel,
    inputAriaLabel,
    iconPath,
    iconSize = 0.75,
    iconStyle,
    isUploading,
    buttonProps,
    onArtifactsSelected
  } = props;
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
        aria-label={buttonAriaLabel}
        {...buttonProps}
        loading={isUploading}
        onClick={() => {
          fileInputRef.current?.click();
        }}
        startIcon={<Icon path={iconPath} size={iconSize} style={iconStyle} />}>
        {label}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileSelection}
        aria-label={inputAriaLabel}
      />
    </Box>
  );
};
