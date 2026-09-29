import { PropsWithChildren } from 'react';
import { cleanup, render } from 'test-helpers/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { AdminTicketContextProvider, ITicketContext, TicketContext, UserTicketContextProvider } from './ticketContext';

const { mockUseParams } = vi.hoisted(() => ({ mockUseParams: vi.fn() }));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => mockUseParams() };
});

const TICKET_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Renders a ticket context provider and captures the value it provides.
 *
 * @param {React.ComponentType<PropsWithChildren>} Provider The provider under test.
 * @returns {ITicketContext | undefined} The provided context value.
 */
const renderProvider = (Provider: React.ComponentType<PropsWithChildren>): ITicketContext | undefined => {
  let capturedContext: ITicketContext | undefined;

  render(
    <Provider>
      <TicketContext.Consumer>
        {(value) => {
          capturedContext = value;
          return null;
        }}
      </TicketContext.Consumer>
    </Provider>
  );

  return capturedContext;
};

describe('ticket context providers', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ ticketId: TICKET_ID });
  });

  it('scopes admin routes to the administrative ticket endpoints', () => {
    expect(renderProvider(AdminTicketContextProvider)).toEqual({
      ticketId: TICKET_ID,
      ticketScope: 'admin',
      ticketQueryKey: ticketQueryKeys.detail('admin', TICKET_ID)
    });
  });

  it('scopes portal routes to the user ticket endpoints', () => {
    expect(renderProvider(UserTicketContextProvider)).toEqual({
      ticketId: TICKET_ID,
      ticketScope: 'user',
      ticketQueryKey: ticketQueryKeys.detail('user', TICKET_ID)
    });
  });

  it('throws when the route has no ticket id', () => {
    mockUseParams.mockReturnValue({});
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderProvider(AdminTicketContextProvider)).toThrow('Missing ticketId route parameter');
  });
});
