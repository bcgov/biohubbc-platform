import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useDialogContext } from 'hooks/useContext';
import { ITicketWithHistory, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { EditTicketDialog } from '../../components/dialog/edit/EditTicketDialog';
import { useOptimisticTicketHandlers } from '../../hooks/useOptimisticTicketHandlers';
import { useTicketEditDialog } from '../../hooks/useTicketEditDialog';
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
  const { isSavingTicket, isEditDialogOpen, openEditDialog, closeEditDialog, handleEditTicket } = useTicketEditDialog({
    ticket
  });
  const { isSavingStatus, requestStatusChange } = useOptimisticTicketHandlers({
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
    dialogContext.setOkDialog({
      open: true,
      dialogTitle: 'Ticket Description',
      dialogText: '',
      dialogContent: <Typography>{ticket.description}</Typography>,
      onClose: () => dialogContext.setOkDialog({ open: false })
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
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Chip label={`${ticket.priority} priority`} sx={{ textTransform: 'capitalize' }} />
              <Chip
                label={ticket.status}
                color={ticket.status === 'open' ? 'success' : 'default'}
                sx={{ textTransform: 'capitalize' }}
              />
            </Stack>
            {ticket.description ? (
              <TicketHeaderSubtitle text={ticket.description} onReadMore={handleReadMoreClick} />
            ) : null}
          </Stack>
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
