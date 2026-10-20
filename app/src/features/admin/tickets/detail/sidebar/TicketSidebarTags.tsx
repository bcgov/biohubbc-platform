import Skeleton from '@mui/material/Skeleton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TagAutocomplete } from 'components/tags/TagAutocomplete';
import { TagChip } from 'components/tags/TagChip';
import { useTicketTagsQuery } from '../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../hooks/useUpdateTicketTagsMutation';
import { TicketSidebarSection } from './TicketSidebarSection';
import { TicketTagChip } from './TicketTagChip';

/**
 * Tags section of the administrative ticket sidebar: a tag search and multi-select that saves the ticket's complete
 * tag set on each change, showing the change before it is saved.
 *
 * Tags added by rules say so on hover, and can be removed like any other tag.
 *
 * @returns {JSX.Element} The ticket tags section.
 */
export const TicketSidebarTags = () => {
  const ticketTagsQuery = useTicketTagsQuery();
  const updateTicketTagsMutation = useUpdateTicketTagsMutation();

  const ticketTags = ticketTagsQuery.data?.tags ?? [];
  const ticketTagsById = new Map(ticketTags.map((ticketTag) => [ticketTag.tag_id, ticketTag]));

  return (
    <TicketSidebarSection label="Tags">
      <LoadingGuard
        isLoading={!ticketTagsQuery.data && ticketTagsQuery.isFetching}
        isLoadingFallback={<Skeleton variant="rounded" height={40} />}>
        <TagAutocomplete
          id="ticket-tags"
          size="small"
          placeholder="Add tags"
          value={ticketTags}
          renderTagChip={(tag, chipProps) => {
            const ticketTag = ticketTagsById.get(tag.tag_id);
            return ticketTag ? (
              <TicketTagChip {...chipProps} ticketTag={ticketTag} />
            ) : (
              <TagChip {...chipProps} tag={tag} />
            );
          }}
          onChange={(tags) => updateTicketTagsMutation.mutate(tags)}
        />
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
