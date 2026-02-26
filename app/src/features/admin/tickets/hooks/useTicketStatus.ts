import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { TicketStatus } from 'interfaces/useTicketsApi.interface';
import { useState } from 'react';

interface IUseTicketStatusProps {
  ticketId?: string;
  onRefreshTicket: () => Promise<void>;
  onError: (message: string | undefined) => void;
}

/**
 * Ticket status update behavior and saving state.
 *
 * @param {IUseTicketStatusProps} props
 * @return {*}
 */
export const useTicketStatus = (props: IUseTicketStatusProps) => {
  const { ticketId, onRefreshTicket, onError } = props;
  const api = useApi();
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!ticketId) {
      return;
    }

    try {
      setIsSavingStatus(true);
      onError(undefined);

      await api.tickets.updateTicketStatus(ticketId, status);
      await onRefreshTicket();
    } catch (caughtError) {
      const apiError = caughtError as APIError;
      onError(apiError.message || 'Failed to update status.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  return {
    isSavingStatus,
    handleUpdateStatus
  };
};

