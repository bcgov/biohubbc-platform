import React, { PropsWithChildren, useMemo } from 'react';
import { useParams } from 'react-router';
import { TicketAccessScope, ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';

export interface ITicketContext {
  ticketId: string;
  /** Endpoints the ticket is read through: administrative routes read any ticket, portal routes the user's own. */
  ticketScope: TicketAccessScope;
  /** Key of the ticket detail query; components read it with `useTicketQuery` and patch it with `setQueryData`. */
  ticketQueryKey: ReturnType<typeof ticketQueryKeys.detail>;
}

export const TicketContext = React.createContext<ITicketContext | undefined>(undefined);

/**
 * Reads and validates the route-level ticket identifier.
 *
 * This keeps route assumptions centralized so provider logic can focus on the ticket it identifies.
 * Throwing here produces an immediate, explicit failure if route config/regression removes
 * the expected `ticketId` param.
 *
 * @returns {string} The ticket id from the route.
 */
const useTicketIdFromRoute = (): string => {
  const { ticketId } = useParams<{ ticketId: string }>();

  if (!ticketId) {
    throw new Error('Missing ticketId route parameter');
  }

  return ticketId;
};

/**
 * Provides the route's ticket id and the key its detail is cached under.
 *
 * @param {PropsWithChildren<{ ticketScope: TicketAccessScope }>} props The endpoints the ticket is read through.
 * @returns {JSX.Element} The provider.
 */
const TicketContextProvider = ({ children, ticketScope }: PropsWithChildren<{ ticketScope: TicketAccessScope }>) => {
  const ticketId = useTicketIdFromRoute();
  const value = useMemo(
    () => ({ ticketId, ticketScope, ticketQueryKey: ticketQueryKeys.detail(ticketScope, ticketId) }),
    [ticketId, ticketScope]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

/**
 * Provides ticket route context for admin ticket detail pages, which read the ticket through the administrative API.
 *
 * @param {PropsWithChildren} props
 * @return {*}
 */
export const AdminTicketContextProvider = ({ children }: PropsWithChildren) => {
  return <TicketContextProvider ticketScope="admin">{children}</TicketContextProvider>;
};

/**
 * Provides ticket route context for portal (user-facing) ticket detail pages, which read the ticket through the
 * user API.
 *
 * @param {PropsWithChildren} props
 * @return {*}
 */
export const UserTicketContextProvider = ({ children }: PropsWithChildren) => {
  return <TicketContextProvider ticketScope="user">{children}</TicketContextProvider>;
};
