import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { ToggleButtons, ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { TicketMarkdownContent } from 'features/tickets/markdown/TicketMarkdownContent/components/TicketMarkdownContent';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';
import { TicketArtifactUpload } from '../TicketArtifactUpload';

type TicketCommentFormView = 'write' | 'preview';

interface ITicketCommentFormProps {
  comment: string;
  artifacts: ITicketArtifact[];
  setComment: (comment: string) => void;
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
  const { comment, artifacts, setComment, isUploadingAttachment, onUploadAttachment } = props;
  const [activeTab, setActiveTab] = useState<TicketCommentFormView>('write');
  const viewOptions: ToggleButtonView<TicketCommentFormView>[] = [
    { value: 'write', label: 'Write' },
    { value: 'preview', label: 'Preview' }
  ];

  const handleAttachmentSelection = async (artifacts: File[]) => {
    for (const file of artifacts) {
      await onUploadAttachment(file);
    }
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
          <TicketArtifactUpload
            label="Attach"
            isUploading={isUploadingAttachment}
            onArtifactsSelected={handleAttachmentSelection}
          />
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
