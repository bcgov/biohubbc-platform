import { mdiAttachmentRemove } from '@mdi/js';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ToggleButtons, ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { TicketMarkdownContent } from 'features/tickets/markdown/TicketMarkdownContent/components/TicketMarkdownContent';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction, useState } from 'react';
import { TicketCommentArtifactUpload } from './TicketCommentArtifactUpload';

interface ITicketCommentProps {
  comment: string;
  artifacts: ITicketArtifact[];
  setComment: Dispatch<SetStateAction<string>>;
  isSaving: boolean;
  isUploadingAttachment: boolean;
  onAddComment: () => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
}

/**
 * Renders the ticket comment input section.
 *
 * @param {ITicketCommentProps} props
 * @return {*}
 */
export const TicketComment = (props: ITicketCommentProps) => {
  const { comment, artifacts, setComment, isSaving, isUploadingAttachment, onAddComment, onUploadAttachment } = props;
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const viewOptions: ToggleButtonView<'write' | 'preview'>[] = [
    { value: 'write', label: 'Write' },
    { value: 'preview', label: 'Preview' }
  ];

  const handleAttachmentSelection = async (files: File[]) => {
    for (const file of files) {
      await onUploadAttachment(file);
    }
  };

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            New Comment
          </Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <ToggleButtons
              views={viewOptions}
              activeView={activeTab}
              onViewChange={setActiveTab}
              orientation="horizontal"
            />
            <TicketCommentArtifactUpload
              label="Attach"
              buttonAriaLabel="Attach file"
              inputAriaLabel="Attach file input"
              iconPath={mdiAttachmentRemove}
              iconStyle={{ transform: 'rotate(-45deg)' }}
              isUploading={isUploadingAttachment}
              buttonProps={{ size: 'small' }}
              onArtifactsSelected={handleAttachmentSelection}
            />
          </Box>
        </Box>

        {activeTab === 'write' ? (
          <TextField
            fullWidth
            multiline
            minRows={7}
            placeholder="Type your comment..."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        ) : (
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
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" size="small" disabled={!comment.trim() || isSaving} onClick={onAddComment}>
            Comment
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
