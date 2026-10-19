import Skeleton from '@mui/material/Skeleton';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { TagAutocomplete } from 'components/tags/TagAutocomplete';
import { useTicketTagsQuery } from '../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../hooks/useUpdateTicketTagsMutation';
import { TicketSidebarSection } from './TicketSidebarSection';

/**
 * Tags section of the administrative ticket sidebar: a tag search and multi-select that saves the ticket's complete
 * tag set on each change, showing the change before it is saved.
 *
 * @returns {JSX.Element} The ticket tags section.
 */
export const TicketSidebarTags = () => {
  const ticketTagsQuery = useTicketTagsQuery();
  const updateTicketTagsMutation = useUpdateTicketTagsMutation();

  return (
    <TicketSidebarSection label="Tags">
      <LoadingGuard
        isLoading={!ticketTagsQuery.data && ticketTagsQuery.isFetching}
        isLoadingFallback={<Skeleton variant="rounded" height={40} />}>
        <TagAutocomplete
          id="ticket-tags"
          size="small"
          placeholder="Add tags"
          value={ticketTagsQuery.data?.tags ?? []}
          onChange={(tags) => updateTicketTagsMutation.mutate(tags)}
        />
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
