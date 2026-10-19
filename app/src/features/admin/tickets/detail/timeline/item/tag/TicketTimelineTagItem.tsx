import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { ITicketTagEvent } from 'interfaces/useTagsApi.interface';

interface ITicketTimelineTagItemProps {
  tagEvent: ITicketTagEvent;
  dateLabel: string;
}

/**
 * Ticket timeline row for a tag added to or removed from the ticket: "Tag <chip> added by <user>".
 *
 * @param {ITicketTimelineTagItemProps} props The tag event and its date label.
 * @returns {JSX.Element} The tag event row.
 */
export const TicketTimelineTagItem = (props: ITicketTimelineTagItemProps) => {
  const { tagEvent, dateLabel } = props;
  const actor = tagEvent.user_identifier ? ` by ${tagEvent.user_identifier}` : '';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="body2">Tag</Typography>
      <TagChip tag={{ name: tagEvent.tag_name, color: tagEvent.tag_color }} />
      <Typography variant="body2">
        {tagEvent.action}
        {actor}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {dateLabel}
      </Typography>
    </Box>
  );
};
