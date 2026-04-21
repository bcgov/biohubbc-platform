import { Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useBiohubUserWrapper from 'hooks/useBiohubUserWrapper';
import { useDialogContext, useTicketContext } from 'hooks/useContext';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { useMemo, useState } from 'react';

interface ITicketAssignmentResponsePromptProps {
  ticket: ITicketExtended | undefined;
}

/**
 * Prompts the current user to start their requested assignment.
 *
 * @param {ITicketAssignmentResponsePromptProps} props
 * @return {*}
 */
export const TicketAssignmentResponsePrompt = (props: ITicketAssignmentResponsePromptProps) => {
  const { ticket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const { ticketId, ticketDataLoader } = useTicketContext();
  const { systemUserId } = useBiohubUserWrapper();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentAssignment = useMemo(() => {
    if (!ticket || !systemUserId) {
      return null;
    }

    return (
      ticket.assignees.find(
        (assignee) => assignee.system_user_id === systemUserId && assignee.status === 'requested'
      ) ?? null
    );
  }, [systemUserId, ticket]);

  if (!currentAssignment) {
    return null;
  }

  const handleStart = async () => {
    try {
      setIsSubmitting(true);
      await api.tickets.updateTicketAssigneeStatus(ticketId, currentAssignment.ticket_system_user_id, {
        status: 'started'
      });
      await ticketDataLoader.refresh(ticketId);
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: apiError.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertBanner severity="info" component={Paper} elevation={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="space-between" alignItems="center">
        <Typography>You are assigned to this ticket. Start work when you are ready.</Typography>
        <Button size="small" variant="contained" disabled={isSubmitting} onClick={handleStart}>
          Start
        </Button>
      </Stack>
    </AlertBanner>
  );
};
