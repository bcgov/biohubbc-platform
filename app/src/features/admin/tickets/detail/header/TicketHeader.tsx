import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { EditTicketDialog } from '../../components/dialog/edit/EditTicketDialog';
import { useOptimisticTicketHandlers } from '../../hooks/useOptimisticTicketHandlers';
import { useTicketEditDialog } from '../../hooks/useTicketEditDialog';

interface ITicketHeaderProps {
  ticket: ITicketExtended;
  activeTab: TicketDetailTab;
  onTabChange: (tab: TicketDetailTab) => void;
}

export type TicketDetailTab = 'timeline' | 'artifacts';

/**
 * Renders the ticket header with breadcrumb, identifier, status, and description.
 *
 * @param {ITicketHeaderProps} props
 * @return {*}
 */
export const TicketHeader = (props: ITicketHeaderProps) => {
  const { ticket, activeTab, onTabChange } = props;
  const { biohubUserWrapper } = useAuthStateContext();
  const { isSavingTicket, isEditDialogOpen, openEditDialog, closeEditDialog, handleEditTicket } = useTicketEditDialog({
    ticket
  });
  const { isSavingStatus, requestStatusChange } = useOptimisticTicketHandlers({ ticket });

  // Open the close/reopen confirmation dialog and dispatch status update on confirm.
  const handleStatusActionClick = () => {
    const nextStatus: TicketStatus = ticket.status === 'open' ? 'closed' : 'open';
    requestStatusChange(nextStatus, biohubUserWrapper.userIdentifier);
  };

  const statusActionButtonLabel = ticket.status === 'open' ? 'Close Ticket' : 'Reopen Ticket';
  const statusActionButtonTestId = ticket.status === 'open' ? 'close-ticket-button' : 'open-ticket-button';
  const statusActionButtonColor = ticket.status === 'closed' ? 'primary' : 'error';

  return (
    <>
      <PageHeader
        maxWidth="xl"
        breadcrumbs={
          <Breadcrumbs aria-label="ticket breadcrumb">
            <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
              Tickets
            </Link>
            <Typography variant="inherit" color="text.primary">
              {`Ticket #${ticket.ticket_slug}`}
            </Typography>
          </Breadcrumbs>
        }
        label={<Typography variant="h1">{ticket.subject}</Typography>}
        buttons={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              color={statusActionButtonColor}
              variant="contained"
              onClick={handleStatusActionClick}
              disabled={isSavingStatus || isSavingTicket}
              data-testid={statusActionButtonTestId}>
              {statusActionButtonLabel}
            </Button>
            <Button size="small" variant="outlined" onClick={openEditDialog} data-testid="edit-ticket-button">
              Edit
            </Button>
          </Stack>
        }
        subheader={
          <Stack direction="row" spacing={1}>
            <Chip label={`${ticket.priority} priority`} sx={{ textTransform: 'capitalize' }} />
            <Chip
              label={ticket.status}
              color={ticket.status === 'open' ? 'success' : 'default'}
              sx={{ textTransform: 'capitalize' }}
            />
          </Stack>
        }
        description={ticket.description}
        descriptionDialogTitle="Ticket Description"
        tabs={
          <TabGroup<TicketDetailTab>
            value={activeTab}
            onChange={onTabChange}
            ariaLabel="Ticket detail sections"
            tabs={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'artifacts', label: 'Files' }
            ]}
          />
        }
      />

      {isEditDialogOpen ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          isLoading={isSavingTicket}
          ticket={ticket}
          onClose={closeEditDialog}
          onSubmit={handleEditTicket}
        />
      ) : null}
    </>
  );
};
