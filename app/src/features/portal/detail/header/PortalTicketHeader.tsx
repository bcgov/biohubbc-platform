import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { TicketHeaderSubtitle } from 'features/admin/tickets/detail/header/TicketHeaderSubtitle';
import { useDialogContext } from 'hooks/useContext';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface IPortalTicketHeaderProps {
  ticket: ITicketWithHistory;
}

/**
 * Read-only ticket header for portal users with breadcrumb, status chips, and description.
 *
 * @param {IPortalTicketHeaderProps} props
 * @return {*}
 */
export const PortalTicketHeader = (props: IPortalTicketHeaderProps) => {
  const { ticket } = props;
  const dialogContext = useDialogContext();

  const handleReadMoreClick = () => {
    dialogContext.setOkDialog({
      open: true,
      dialogTitle: 'Ticket Description',
      dialogText: '',
      dialogContent: <Typography>{ticket.description}</Typography>,
      onClose: () => dialogContext.setOkDialog({ open: false })
    });
  };

  return (
    <PageHeader
      maxWidth="xl"
      breadcrumbs={
        <Breadcrumbs aria-label="ticket breadcrumb">
          <Link component={RouterLink} to="/portal/tickets" underline="hover" color="inherit">
            My Tickets
          </Link>
          <Typography variant="inherit" color="text.primary">
            {`Ticket #${ticket.ticket_slug}`}
          </Typography>
        </Breadcrumbs>
      }
      label={<Typography variant="h1">{ticket.subject}</Typography>}
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
  );
};
