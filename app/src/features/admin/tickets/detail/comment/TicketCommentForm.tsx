import { mdiAttachmentRemove } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { ToggleButtons, ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { TicketMarkdownContent } from 'features/tickets/markdown/TicketMarkdownContent/components/TicketMarkdownContent';
import { useConfigContext, useDialogContext } from 'hooks/useContext';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { ChangeEvent, useRef, useState } from 'react';

type TicketCommentFormView = 'write' | 'preview';

interface ITicketCommentFormProps {
  comment: string;
  artifacts: ITicketArtifact[];
  setComment: (comment: string) => void;
  isSaving: boolean;
  isUploadingAttachment: boolean;
  onUploadAttachment: (file: File) => Promise<void>;
}

/**
 * Shared markdown comment editor body.
 *
 * @param {ITicketCommentFormProps} props
 * @return {*}
 */
export const TicketCommentForm = (props: ITicketCommentFormProps) => {
  const { comment, artifacts, setComment, isSaving, isUploadingAttachment, onUploadAttachment } = props;
  const config = useConfigContext();
  const dialogContext = useDialogContext();
  const [activeTab, setActiveTab] = useState<TicketCommentFormView>('write');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const viewOptions: ToggleButtonView<TicketCommentFormView>[] = [
    { value: 'write', label: 'Write' },
    { value: 'preview', label: 'Preview' }
  ];

  const handleAttachmentSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length > config.MAX_UPLOAD_NUM_FILES) {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: 'Number of files uploaded at once exceeds maximum'
      });
      event.target.value = '';
      return;
    }

    for (const file of files) {
      await onUploadAttachment(file);
    }

    event.target.value = '';
  };

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <ToggleButtons
            views={viewOptions}
            activeView={activeTab}
            onViewChange={setActiveTab}
            orientation="horizontal"
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isUploadingAttachment && <CircularProgress size={14} />}
            <Button
              aria-label="Attach file"
              size="small"
              onClick={() => {
                attachmentInputRef.current?.click();
              }}
              disabled={isSaving || isUploadingAttachment}
              startIcon={<Icon path={mdiAttachmentRemove} size={0.75} style={{ transform: 'rotate(-45deg)' }} />}>
              Attach
            </Button>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              hidden
              onChange={handleAttachmentSelection}
              aria-label="Attach file input"
            />
          </Box>
        </Box>
      </Box>

      <ComponentSwitch<TicketCommentFormView>
        switch={activeTab}
        components={{
          write: (
            <TextField
              fullWidth
              multiline
              minRows={7}
              placeholder="Type your comment..."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          ),
          preview: (
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                minHeight: 112,
                p: 1.5
              }}>
              <LoadingGuard
                hasNoData={!comment.trim()}
                hasNoDataFallback={
                  <Typography variant="body2" color="text.secondary">
                    Nothing to preview.
                  </Typography>
                }>
                <TicketMarkdownContent content={comment} artifacts={artifacts} />
              </LoadingGuard>
            </Box>
          )
        }}
      />
    </>
  );
};
