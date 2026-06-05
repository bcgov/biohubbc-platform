import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';

export interface ITicketContext {
  ticketId: string;
  ticketDataLoader: DataLoader<[string], ITicketExtended, unknown>;
}

export const TicketContext = React.createContext<ITicketContext | undefined>(undefined);
type TicketFetcher = (ticketId: string) => Promise<ITicketExtended>;

/**
 * Reads and validates the route-level ticket identifier.
 *
 * This keeps route assumptions centralized so provider logic can focus on data loading.
 * Throwing here produces an immediate, explicit failure if route config/regression removes
 * the expected `ticketId` param.
 */
const useTicketIdFromRoute = (): string => {
  const { ticketId } = useParams<{ ticketId: string }>();

  if (!ticketId) {
    throw new Error('Missing ticketId route parameter');
  }

  return ticketId;
};

/**
 * Shared hook that derives the `ITicketContext` value from a caller-provided fetcher.
 *
 * The fetcher differs by caller (admin endpoint vs user endpoint), but context shape and
 * refresh behavior are identical, so this hook keeps that behavior in one place.
 */
const useTicketContextValue = (fetchTicket: TicketFetcher): ITicketContext => {
  const ticketId = useTicketIdFromRoute();
  const ticketDataLoader = useDataLoader(fetchTicket);

  /**
   * Always refresh when the route points to a different ticket.
   *
   * `useDataLoader` currently returns new method references on render, so adding those
   * methods to deps causes needless refresh loops. The intended trigger is route change,
   * therefore `ticketId` is the sole dependency.
   */
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
 * Internal reusable provider that wires a caller-specific ticket fetch function into the
 * shared ticket context value.
 */
const TicketContextProvider = ({ children, fetchTicket }: PropsWithChildren<{ fetchTicket: TicketFetcher }>) => {
  const value = useTicketContextValue(fetchTicket);

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
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
  const getTicketForAdmin = api.tickets.getTicketForAdmin;

  return <TicketContextProvider fetchTicket={getTicketForAdmin}>{children}</TicketContextProvider>;
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
  const getTicketForUser = api.tickets.getTicketForUser;

  return <TicketContextProvider fetchTicket={getTicketForUser}>{children}</TicketContextProvider>;
};
