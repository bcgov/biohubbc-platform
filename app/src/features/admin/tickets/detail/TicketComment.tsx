import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Dispatch, SetStateAction } from 'react';

interface ITicketCommentProps {
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
}

/**
 * Renders the ticket comment input section.
 *
 * @param {ITicketCommentProps} props
 * @return {*}
 */
export const TicketComment = (props: ITicketCommentProps) => {
  const { comment, setComment } = props;

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 3, py: 2 }}>
        <Typography component="h3" sx={{ fontWeight: 700 }}>
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
      </Box>
    </Paper>
  );
};
