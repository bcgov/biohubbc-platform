import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Dispatch, SetStateAction } from 'react';

interface ITicketCommentProps {
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  isSaving: boolean;
  onAddComment: () => Promise<void>;
}

/**
 * Renders the ticket comment input section.
 *
 * @param {ITicketCommentProps} props
 * @return {*}
 */
export const TicketComment = (props: ITicketCommentProps) => {
  const { comment, setComment, isSaving, onAddComment } = props;

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Comment
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ p: 3 }}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          placeholder="Type your comment..."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" size="small" disabled={!comment.trim() || isSaving} onClick={onAddComment}>
            Comment
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
