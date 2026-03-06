import { APIError } from 'hooks/api/useAxios';
import { useDialogContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ITicket, TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketStatusProps {
  ticketId?: string;
  onRefreshTicket?: () => Promise<void>;
}

interface IUpdateTicketStatusOptions {
  onOptimisticUpdate?: () => void;
  onSuccess?: (updatedTicket: ITicket) => void;
  onErrorRollback?: () => void;
}

/**
 * Ticket status update behavior and saving state.
 *
 * @param {IUseTicketStatusProps} props
 * @return {*}
 */
export const useTicketStatus = (props: IUseTicketStatusProps) => {
  const { ticketId, onRefreshTicket } = props;
  const api = useApi();
  const dialogContext = useDialogContext();
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const handleError = (message: string | undefined) => {
    if (!message) {
      return;
    }

    dialogContext.setSnackbar({
      open: true,
      snackbarMessage: message
    });
  };

  const handleUpdateStatus = async (status: TicketStatus, options?: IUpdateTicketStatusOptions) => {
    if (!ticketId) {
      return;
    }

    try {
      setIsSavingStatus(true);
      options?.onOptimisticUpdate?.();

      const updatedTicket = await api.tickets.updateTicketStatus(ticketId, status);
      options?.onSuccess?.(updatedTicket);

      if (onRefreshTicket) {
        await onRefreshTicket();
      }
    } catch (caughtError) {
      options?.onErrorRollback?.();
      const apiError = caughtError as APIError;
      handleError(apiError.message);
    } finally {
      setIsSavingStatus(false);
    }
  };

  return {
    isSavingStatus,
    handleError,
    handleUpdateStatus
  };
};
