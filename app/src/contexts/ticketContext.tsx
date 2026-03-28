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
 * Shared hook that derives the ITicketContext value for a given fetch function.
 * Not exported — consumed only by the named provider variants below.
 */
const useTicketContextValue = (fetchTicket: (ticketId: string) => Promise<ITicketWithHistory>): ITicketContext => {
  const { ticketId } = useParams<{ ticketId: string }>();

  if (!ticketId) {
    throw new Error('Missing ticketId route parameter');
  }

  const ticketDataLoader = useDataLoader(fetchTicket);

  useEffect(() => {
    ticketDataLoader.refresh(ticketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  return useMemo(
    () => ({
      ticketId,
      ticketDataLoader
    }),
    [ticketId, ticketDataLoader]
  );
};

/**
 * Provides ticket route context for admin ticket detail pages.
 * Fetches ticket data using the administrative API endpoint.
 *
 * @param {PropsWithChildren} props
 * @return {*}
 */
export const AdminTicketContextProvider = ({ children }: PropsWithChildren) => {
  const api = useApi();
  const value = useTicketContextValue(api.tickets.getTicketForAdmin);

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

/**
 * Provides ticket route context for portal (user-facing) ticket detail pages.
 * Fetches ticket data using the user API endpoint.
 *
 * @param {PropsWithChildren} props
 * @return {*}
 */
export const UserTicketContextProvider = ({ children }: PropsWithChildren) => {
  const api = useApi();
  const value = useTicketContextValue(api.tickets.getTicketForUser);

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};
