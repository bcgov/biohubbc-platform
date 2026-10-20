import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TagChip } from 'components/tags/TagChip';
import { ITicketTagEvent } from 'interfaces/useTagsApi.interface';

interface ITicketTimelineTagItemProps {
  tagEvent: ITicketTagEvent;
  dateLabel: string;
}

/**
 * The actor of a tag event: the rule that added the tag, otherwise the user who made the change, if known.
 *
 * @param {ITicketTagEvent} tagEvent The tag event.
 * @returns {string} The actor suffix, such as " by rule 'Failed uploads'", or empty.
 */
const getTagEventActor = (tagEvent: ITicketTagEvent): string => {
  if (tagEvent.action === 'added' && tagEvent.tag_rule_name) {
    return ` by rule '${tagEvent.tag_rule_name}'`;
  }

  return tagEvent.user_identifier ? ` by ${tagEvent.user_identifier}` : '';
};

/**
 * Ticket timeline row for a tag added to or removed from the ticket: "Tag <chip> added by <user>", or
 * "Tag <chip> added by rule '<rule>'" when a rule added it.
 *
 * @param {ITicketTimelineTagItemProps} props The tag event and its date label.
 * @returns {JSX.Element} The tag event row.
 */
export const TicketTimelineTagItem = (props: ITicketTimelineTagItemProps) => {
  const { tagEvent, dateLabel } = props;
  const actor = getTagEventActor(tagEvent);

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
