import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ITicketArtifact } from 'interfaces/useTicketsApi.interface';
import { Dispatch, SetStateAction } from 'react';
import { TicketCommentForm } from './TicketCommentForm';

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
        <TicketCommentForm
          comment={comment}
          artifacts={artifacts}
          setComment={setComment}
          isUploadingAttachment={isUploadingAttachment}
          disabled={isSaving}
          onUploadAttachment={onUploadAttachment}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            disabled={!comment.trim() || isSaving}
            loading={isSaving}
            onClick={onAddComment}>
            Comment
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
