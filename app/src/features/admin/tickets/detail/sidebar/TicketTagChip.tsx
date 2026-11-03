import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { ITagChipProps, TagChip } from 'components/tags/TagChip';
import { ITicketTag } from 'interfaces/useTagsApi.interface';

interface ITicketTagChipProps extends Omit<ITagChipProps, 'tag'> {
  ticketTag: ITicketTag;
}

/**
 * A ticket's tag chip that says, on hover, which rule added the tag, if one did. Other chip props pass through.
 *
 * @param {ITicketTagChipProps} props The ticket tag, and any other chip props.
 * @returns {JSX.Element} The ticket tag chip.
 */
export const TicketTagChip = (props: ITicketTagChipProps) => {
  const { ticketTag, ...chipProps } = props;
  const chip = <TagChip {...chipProps} tag={ticketTag} />;

  if (!ticketTag.tag_rule_name) {
    return chip;
  }

  return (
    <Tooltip title={`Added by rule '${ticketTag.tag_rule_name}'`}>
      {/* The tooltip needs an element that holds a ref; the chip does not forward one. */}
      <Box component="span" sx={{ display: 'inline-flex', maxWidth: '100%' }}>
        {chip}
      </Box>
    </Tooltip>
  );
};
