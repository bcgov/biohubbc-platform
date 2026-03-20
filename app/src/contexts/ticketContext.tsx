import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ITicketContext {
  ticketId: string;
  ticketDataLoader: DataLoader<[string], ITicketWithHistory, unknown>;
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

  if (!ticketId) {
    throw new Error('Missing ticketId route parameter');
  }

  const ticketDataLoader = useDataLoader((currentTicketId: string) => api.tickets.getTicket(currentTicketId));

  useEffect(() => {
    ticketDataLoader.refresh(ticketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const value: ITicketContext = useMemo(
    () => ({
      ticketId,
      ticketDataLoader
    }),
    [ticketId, ticketDataLoader]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};
