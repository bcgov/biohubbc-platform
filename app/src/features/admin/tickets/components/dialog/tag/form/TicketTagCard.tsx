import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ITagSummary } from 'interfaces/useTagsApi.interface';

interface ITicketTagCardProps {
  tag: ITagSummary;
  isSubmitting: boolean;
  onRemoveTag: () => void;
}

/**
 * Card row for one of the ticket's tags in the tag dialog: the tag's color and name, with a button that removes it.
 *
 * @param {ITicketTagCardProps} props The tag, whether the dialog is saving, and the remove handler.
 * @returns {JSX.Element} The ticket tag card.
 */
export const TicketTagCard = (props: ITicketTagCardProps) => {
  const { tag, isSubmitting, onRemoveTag } = props;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: 'grey.100',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, backgroundColor: tag.color }} />
        <Typography sx={{ fontWeight: 500 }} noWrap title={tag.name}>
          {tag.name}
        </Typography>
      </Stack>
      <IconButton size="small" aria-label={`remove ${tag.name}`} onClick={onRemoveTag} disabled={isSubmitting}>
        <Icon path={mdiClose} size={0.65} />
      </IconButton>
    </Paper>
  );
};
