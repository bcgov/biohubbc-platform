import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useTicketTagsQuery } from '../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../hooks/useUpdateTicketTagsMutation';
import { TicketSidebarSection } from './TicketSidebarSection';
import { TicketTagChip } from './TicketTagChip';

interface ITicketSidebarTagsProps {
  /** Opens the dialog that edits the ticket's tags. */
  onOpenDialog: () => void;
}

/**
 * Tags section of the administrative ticket sidebar: the ticket's tags as chips in a wrapping row. The add button
 * opens the dialog that edits the ticket's tags; each chip's remove icon removes its tag at once, showing the change
 * before it is saved.
 *
 * Tags added by rules say so on hover, and can be removed like any other tag.
 *
 * @param {ITicketSidebarTagsProps} props The add dialog's open handler.
 * @returns {JSX.Element} The ticket tags section.
 */
export const TicketSidebarTags = (props: ITicketSidebarTagsProps) => {
  const { onOpenDialog } = props;
  const ticketTagsQuery = useTicketTagsQuery();
  const updateTicketTagsMutation = useUpdateTicketTagsMutation();

  const ticketTags = ticketTagsQuery.data?.tags ?? [];

  return (
    <TicketSidebarSection label="Tags" onAdd={onOpenDialog}>
      <LoadingGuard
        isLoading={!ticketTagsQuery.data && ticketTagsQuery.isFetching}
        isLoadingFallback={<Skeleton variant="rounded" height={24} />}
        hasNoData={!ticketTags.length}
        hasNoDataFallback={
          <Typography variant="body2" color="textSecondary">
            No tags
          </Typography>
        }>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {ticketTags.map((ticketTag) => (
            <TicketTagChip
              key={ticketTag.tag_id}
              ticketTag={ticketTag}
              deleteIcon={<Icon path={mdiClose} size={0.6} aria-label={`remove ${ticketTag.name}`} />}
              onDelete={() =>
                updateTicketTagsMutation.mutate(ticketTags.filter((tag) => tag.tag_id !== ticketTag.tag_id))
              }
            />
          ))}
        </Stack>
      </LoadingGuard>
    </TicketSidebarSection>
  );
};
