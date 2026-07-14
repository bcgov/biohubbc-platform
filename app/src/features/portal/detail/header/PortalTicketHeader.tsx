import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface IPortalTicketHeaderProps {
  ticket: ITicketExtended;
}

/**
 * Read-only ticket header for portal users with breadcrumb, status chips, and description.
 *
 * @param {IPortalTicketHeaderProps} props
 * @return {*}
 */
export const PortalTicketHeader = (props: IPortalTicketHeaderProps) => {
  const { ticket } = props;

  return (
    <PageHeader
      maxWidth="xl"
      breadcrumbs={
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/portal/ticket" underline="hover" color="inherit">
            Portal
          </Link>
          <Typography color="text.primary">{ticket.subject}</Typography>
        </Breadcrumbs>
      }
      label={<Typography variant="h1">{ticket.subject}</Typography>}
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
    />
  );
};
