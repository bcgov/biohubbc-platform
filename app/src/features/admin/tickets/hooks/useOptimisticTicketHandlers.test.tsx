import { act, renderHook } from '@testing-library/react';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { useOptimisticTicketHandlers } from './useOptimisticTicketHandlers';

const mockUpdateTicketStatus = vi.fn();
const mockSetYesNoDialog = vi.fn();
const mockSetSnackbar = vi.fn();
const mockSetTicketData = vi.fn();
let mockTicketData: ITicketExtended;

const baseDataRequest: DataRequestResponse = {
  data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  reason: 'Need data access',
  team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  requested_by: 1,
  ticket_id: '11111111-1111-1111-1111-111111111111',
  policy_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  status: PolicyStatus.REQUESTED,
  create_date: '2026-03-01T00:00:00.000Z'
};

const baseTicket: ITicketExtended = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900001',
  subject: 'Ticket subject',
  description: 'Ticket description',
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-03-01T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references: [],
  ticket_system_users: [],
  data_requests: []
};

vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    tickets: {
      updateTicketStatus: mockUpdateTicketStatus
    }
  })
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({
    setYesNoDialog: mockSetYesNoDialog,
    setSnackbar: mockSetSnackbar
  }),
  useTicketContext: () => ({
    ticketId: baseTicket.ticket_id,
    ticketDataLoader: {
      data: mockTicketData,
      setData: mockSetTicketData
    }
  })
}));

describe('useOptimisticTicketHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTicketData = baseTicket;
  });

  it('shows snackbar and blocks close confirmation when ticket has requested data requests', () => {
    const ticketWithUnaddressedDataRequest: ITicketExtended = {
      ...baseTicket,
      data_requests: [baseDataRequest]
    };

    mockTicketData = ticketWithUnaddressedDataRequest;

    const { result } = renderHook(() => useOptimisticTicketHandlers({ ticket: ticketWithUnaddressedDataRequest }));

    act(() => {
      result.current.requestStatusChange('closed', 'test-user');
    });

    expect(mockSetSnackbar).toHaveBeenCalledWith({
      open: true,
      snackbarMessage: 'Cannot close tickets that have unaddressed data requests'
    });
    expect(mockSetYesNoDialog).not.toHaveBeenCalled();
  });

  it('opens close confirmation when all data requests are actioned', () => {
    const ticketWithActionedDataRequest: ITicketExtended = {
      ...baseTicket,
      data_requests: [
        {
          ...baseDataRequest,
          status: PolicyStatus.APPROVED
        }
      ]
    };

    mockTicketData = ticketWithActionedDataRequest;

    const { result } = renderHook(() => useOptimisticTicketHandlers({ ticket: ticketWithActionedDataRequest }));

    act(() => {
      result.current.requestStatusChange('closed', 'test-user');
    });

    expect(mockSetSnackbar).not.toHaveBeenCalled();
    expect(mockSetYesNoDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        dialogTitle: 'Close Ticket'
      })
    );
  });
});
