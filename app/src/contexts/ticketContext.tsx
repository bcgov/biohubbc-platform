import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { ITicketCommentLog, ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import React, { PropsWithChildren, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';

export interface ITicketContext {
  ticketId: string;
  ticketDataLoader: DataLoader<[string], ITicketWithHistory, unknown>;
  updateTicket: (nextTicket: ITicketWithHistory) => Promise<void>;
  handleComment: (comment: string) => Promise<void>;
}

export const TicketContext = React.createContext<ITicketContext | undefined>(undefined);

/**
 * Provides ticket route context for ticket detail pages.
 *
 * @param {PropsWithChildren} props
 * @return {*}
 */
export const TicketContextProvider = ({ children }: PropsWithChildren) => {
  const api = useApi();
  const { ticketId } = useParams<{ ticketId: string }>();
  const latestSnapshotRef = useRef<ITicketWithHistory | null>(null);
  const operationInProgress = useRef(false);

  if (!ticketId) {
    throw new Error('Missing ticketId route parameter');
  }

  const ticketDataLoader = useDataLoader((currentTicketId: string) => api.tickets.getTicket(currentTicketId));

  useEffect(() => {
    ticketDataLoader.refresh(ticketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const updateTicket = useCallback(
    async (nextTicket: ITicketWithHistory): Promise<void> => {
      const currentTicket = ticketDataLoader.data;

      if (!currentTicket || operationInProgress.current) {
        return;
      }

      operationInProgress.current = true;
      latestSnapshotRef.current = currentTicket;
      ticketDataLoader.setData(nextTicket);

      try {
        await api.tickets.updateTicket(ticketId, {
          title: nextTicket.title,
          description: nextTicket.description,
          priority: nextTicket.priority,
          status: nextTicket.status
        });

        await ticketDataLoader.refresh(ticketId);
        latestSnapshotRef.current = null;
      } catch (error) {
        if (latestSnapshotRef.current) {
          ticketDataLoader.setData(latestSnapshotRef.current);
        }

        latestSnapshotRef.current = null;
        throw error;
      } finally {
        operationInProgress.current = false;
      }
    },
    [api.tickets, ticketDataLoader, ticketId]
  );

  const handleComment = useCallback(
    async (comment: string): Promise<void> => {
      const trimmedComment = comment.trim();

      if (!trimmedComment) {
        return;
      }

      const createdComment = await api.tickets.createTicketComment(ticketId, { comment: trimmedComment });
      const currentTicket = ticketDataLoader.data;

      if (!createdComment || !currentTicket) {
        return;
      }

      const nextComment: ITicketCommentLog = {
        ticket_comment_id: createdComment.ticket_comment_id ?? `${createdComment.create_date}-${Date.now()}`,
        ticket_id: createdComment.ticket_id,
        user_identifier: createdComment.user_identifier,
        create_date: createdComment.create_date,
        comment: createdComment.comment ?? trimmedComment
      };

      ticketDataLoader.setData({
        ...currentTicket,
        comment_log: [...currentTicket.comment_log, nextComment]
      });
    },
    [api.tickets, ticketDataLoader, ticketId]
  );

  const value: ITicketContext = useMemo(
    () => ({
      ticketId,
      ticketDataLoader,
      updateTicket,
      handleComment
    }),
    [ticketId, ticketDataLoader, updateTicket, handleComment]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};
