import { waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { cleanup, render } from 'test-helpers/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminTicketContextProvider, ITicketContext, TicketContext, UserTicketContextProvider } from './ticketContext';

const { mockUseParams, mockTicketsApi, mockUseApi } = vi.hoisted(() => {
  const useParams = vi.fn();

  const ticketsApi = {
    getTicketForAdmin: vi.fn(),
    getTicketForUser: vi.fn()
  };

  const useApi = vi.fn(() => ({ tickets: ticketsApi }));

  return { mockUseParams: useParams, mockTicketsApi: ticketsApi, mockUseApi: useApi };
});

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => mockUseParams() };
});

vi.mock('hooks/useApi', () => ({
  useApi: () => mockUseApi()
}));

const TICKET_ID = '11111111-1111-1111-1111-111111111111';

const mockTicket = {
  ticket_id: TICKET_ID,
  ticket_slug: '04900001',
  subject: 'Test ticket',
  description: null,
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-02-25T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references: []
};

type ProviderHarness = {
  getContext: () => ITicketContext;
};

const renderProvider = (Provider: React.ComponentType<PropsWithChildren>): ProviderHarness => {
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

  return {
    getContext: () => {
      if (!capturedContext) {
        throw new Error('TicketContext was never provided');
      }

      return capturedContext;
    }
  };
};

describe('AdminTicketContextProvider', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ ticketId: TICKET_ID });
    mockTicketsApi.getTicketForAdmin.mockResolvedValue(mockTicket);
    mockTicketsApi.getTicketForUser.mockResolvedValue(mockTicket);
  });

  it('exposes the ticketId from route params in context', async () => {
    const { getContext } = renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketId).toBe(TICKET_ID);
    });
  });

  it('exposes a ticketDataLoader in context', async () => {
    const { getContext } = renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader).toBeDefined();
    });
  });

  it('calls getTicketForAdmin with the ticketId on mount', async () => {
    renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(mockTicketsApi.getTicketForAdmin).toHaveBeenCalledWith(TICKET_ID);
    });
  });

  it('does not call getTicketForUser', async () => {
    renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(mockTicketsApi.getTicketForAdmin).toHaveBeenCalled();
    });

    expect(mockTicketsApi.getTicketForUser).not.toHaveBeenCalled();
  });

  it('surfaces ticket data in the data loader after a successful fetch', async () => {
    const { getContext } = renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader.data).toEqual(mockTicket);
    });
  });

  it('surfaces the error in the data loader when the fetch fails', async () => {
    const fetchError = new Error('admin fetch failed');
    mockTicketsApi.getTicketForAdmin.mockRejectedValueOnce(fetchError);

    const { getContext } = renderProvider(AdminTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader.error).toBe(fetchError);
    });
  });
});

describe('UserTicketContextProvider', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ ticketId: TICKET_ID });
    mockTicketsApi.getTicketForAdmin.mockResolvedValue(mockTicket);
    mockTicketsApi.getTicketForUser.mockResolvedValue(mockTicket);
  });

  it('exposes the ticketId from route params in context', async () => {
    const { getContext } = renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketId).toBe(TICKET_ID);
    });
  });

  it('exposes a ticketDataLoader in context', async () => {
    const { getContext } = renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader).toBeDefined();
    });
  });

  it('calls getTicketForUser with the ticketId on mount', async () => {
    renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(mockTicketsApi.getTicketForUser).toHaveBeenCalledWith(TICKET_ID);
    });
  });

  it('does not call getTicketForAdmin', async () => {
    renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(mockTicketsApi.getTicketForUser).toHaveBeenCalled();
    });

    expect(mockTicketsApi.getTicketForAdmin).not.toHaveBeenCalled();
  });

  it('surfaces ticket data in the data loader after a successful fetch', async () => {
    const { getContext } = renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader.data).toEqual(mockTicket);
    });
  });

  it('surfaces the error in the data loader when the fetch fails', async () => {
    const fetchError = new Error('user fetch failed');
    mockTicketsApi.getTicketForUser.mockRejectedValueOnce(fetchError);

    const { getContext } = renderProvider(UserTicketContextProvider);

    await waitFor(() => {
      expect(getContext().ticketDataLoader.error).toBe(fetchError);
    });
  });
});
