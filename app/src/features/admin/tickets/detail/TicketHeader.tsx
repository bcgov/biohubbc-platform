import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { useDialogContext } from 'hooks/useContext';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { Link as RouterLink } from 'react-router-dom';

interface ITicketHeaderProps {
  ticket?: ITicketWithHistory;
  onEdit?: () => void;
}

/**
 * Renders the ticket header with breadcrumb, identifier, status, and description.
 *
 * @param {ITicketHeaderProps} props
 * @return {*}
 */
export const TicketHeader = (props: ITicketHeaderProps) => {
  const { ticket, onEdit } = props;
  const dialogContext = useDialogContext();
  const descriptionPreviewMaxLength = 300;

  const handleReadMoreClick = () => {
    if (!ticket?.description) {
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

  const getDescriptionPreview = (description: string) => {
    if (description.length <= descriptionPreviewMaxLength) {
      return { preview: description, isTruncated: false };
    }

    return {
      preview: description.slice(0, descriptionPreviewMaxLength).trimEnd(),
      isTruncated: true
    };
  };

  return (
    <PageHeader
      maxWidth="lg"
      breadcrumbs={
        <Breadcrumbs aria-label="ticket breadcrumb">
          <Link component={RouterLink} to="/admin/tickets" underline="hover" color="inherit">
            Tickets
          </Link>
          <Typography variant="inherit" color="text.primary">
            {ticket ? `Ticket #${ticket.ticket_slug}` : 'Ticket'}
          </Typography>
        </Breadcrumbs>
      }
      label={<Typography variant="h1">{ticket?.title ?? 'Ticket'}</Typography>}
      buttons={
        <Button variant="outlined" onClick={onEdit} disabled={!ticket} data-testid="edit-ticket-button">
          Edit
        </Button>
      }
      subheader={
        ticket ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Chip label={`${ticket.priority} priority`} sx={{ textTransform: 'capitalize' }} />
              <Chip
                label={ticket.status}
                color={ticket.status === 'open' ? 'success' : 'default'}
                sx={{ textTransform: 'capitalize' }}
              />
            </Stack>
            {ticket.description
              ? (() => {
                  const { preview, isTruncated } = getDescriptionPreview(ticket.description);

                  return (
                    <Typography color="text.secondary" component="div">
                      {preview}
                      {isTruncated ? (
                        <>
                          ...{' '}
                          <Box
                            component="span"
                            sx={{
                              fontWeight: 700,
                              color: 'primary.light',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            onClick={handleReadMoreClick}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleReadMoreClick();
                              }
                            }}>
                            read more
                          </Box>
                        </>
                      ) : null}
                    </Typography>
                  );
                })()
              : null}
          </Stack>
        ) : null
      }
    />
  );
};
