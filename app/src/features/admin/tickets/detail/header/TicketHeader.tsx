import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { PropsWithChildren } from 'react';
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
 * Renders the ticket page in the administrative page layout: the header with breadcrumb, identifier, status,
 * description and tabs, above the selected tab's content passed as children.
 *
 * @param {PropsWithChildren<ITicketHeaderProps>} props
 * @return {*}
 */
export const TicketHeader = (props: PropsWithChildren<ITicketHeaderProps>) => {
  const { ticket, activeTab, onTabChange, children } = props;
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
      <AdminPageLayout
        breadcrumbs={
          <Breadcrumbs aria-label="ticket breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
            <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
              Tickets
            </Link>
            <Typography variant="inherit" color="text.primary">
              {`Ticket #${ticket.ticket_slug}`}
            </Typography>
          </Breadcrumbs>
        }
        title={ticket.subject}
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
        subtitle={
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
        tabs={[
          { value: 'timeline', label: 'Timeline' },
          { value: 'artifacts', label: 'Files' }
        ]}
        activeTab={activeTab}
        onTabChange={onTabChange}>
        {children}
      </AdminPageLayout>

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
