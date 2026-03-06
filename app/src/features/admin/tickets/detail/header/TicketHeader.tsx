import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { EditTicketDialog } from '../../components/dialog/edit/EditTicketDialog';
import { useTicketEditDialog } from '../../hooks/useTicketEditDialog';
import { useTicketStatusOptimistic } from '../../hooks/useTicketStatusOptimistic';
import { TicketHeaderSubtitle } from './TicketHeaderSubtitle';

interface ITicketHeaderProps {
  ticket: ITicketWithHistory;
}

/**
 * Renders the ticket header with breadcrumb, identifier, status, and description.
 *
 * @param {ITicketHeaderProps} props
 * @return {*}
 */
export const TicketHeader = (props: ITicketHeaderProps) => {
  const { ticket } = props;
  const { biohubUserWrapper } = useAuthStateContext();
  const dialogContext = useDialogContext();
  const { ticketDataLoader } = useTicketContext();
  const { isSavingTicket, isEditDialogOpen, openEditDialog, closeEditDialog } = useTicketEditDialog({ ticket });
  const { isSavingStatus, requestStatusChange } = useTicketStatusOptimistic({
    ticket,
    userIdentifier: biohubUserWrapper.userIdentifier
  });

  // Open the close/reopen confirmation dialog and dispatch status update on confirm.
  const handleStatusActionClick = () => {
    const nextStatus: TicketStatus = ticket.status === 'open' ? 'closed' : 'open';
    requestStatusChange(nextStatus);
  };

  // Open full ticket description in a dialog when "Read more" is clicked.
  const handleReadMoreClick = () => {
    if (!ticket.description) {
      return;
    }

    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: 'Ticket Description',
      dialogText: ticket.description,
      onClose: () => dialogContext.setErrorDialog({ open: false }),
      onOk: () => dialogContext.setErrorDialog({ open: false })
    });
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
              color={statusActionButtonColor}
              variant="outlined"
              onClick={handleStatusActionClick}
              disabled={isSavingStatus || isSavingTicket}
              data-testid={statusActionButtonTestId}>
              {statusActionButtonLabel}
            </Button>
            <Button variant="outlined" onClick={openEditDialog} data-testid="edit-ticket-button">
              Edit
            </Button>
          </Stack>
        }
        subheader={
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Chip label={`${ticket.priority} priority`} sx={{ textTransform: 'capitalize' }} />
              <Chip
                label={ticket.status}
                color={ticket.status === 'open' ? 'success' : 'default'}
                sx={{ textTransform: 'capitalize' }}
              />
            </Stack>
            <TicketHeaderSubtitle text={ticket.description ?? undefined} onReadMore={handleReadMoreClick} />
          </Stack>
        }
      />

      {isEditDialogOpen ? (
        <EditTicketDialog
          open={isEditDialogOpen}
          ticket={ticket}
          onClose={closeEditDialog}
          onSubmit={(updatedTicket) => {
            const latestTicket = ticketDataLoader.data;

            if (!latestTicket) {
              return;
            }

            ticketDataLoader.setData({
              ...latestTicket,
              ...updatedTicket,
              statuses: latestTicket.statuses,
              comments: latestTicket.comments,
              references: latestTicket.references
            });
          }}
        />
      ) : null}
    </>
  );
};
