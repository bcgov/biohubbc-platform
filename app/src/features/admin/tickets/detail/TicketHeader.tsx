import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface ITicketHeaderProps {
  ticket?: ITicketWithHistory;
}

/**
 * Renders the ticket header with breadcrumb, identifier, status, and description.
 *
 * @param {ITicketHeaderProps} props
 * @return {*}
 */
export const TicketHeader = (props: ITicketHeaderProps) => {
  const { ticket } = props;

  return (
    <PageHeader
      maxWidth="xl"
      breadcrumbs={
        <Breadcrumbs aria-label="ticket breadcrumb">
          <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
            Tickets
          </Link>
          <Typography color="text.primary">{ticket ? `Ticket #${ticket.ticket_slug}` : 'Ticket'}</Typography>
        </Breadcrumbs>
      }
      label={
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h1">{ticket ? `Ticket #${ticket.ticket_slug}` : 'Ticket'}</Typography>
          {ticket?.status && (
            <Chip
              label={ticket.status === 'open' ? 'Open' : 'Closed'}
              color={ticket.status === 'open' ? 'success' : 'default'}
            />
          )}
        </Stack>
      }
      subheader={ticket?.description}
    />
  );
};
