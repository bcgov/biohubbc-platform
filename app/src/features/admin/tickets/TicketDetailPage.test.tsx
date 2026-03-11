import { screen } from '@testing-library/react';
import { ITicketContext } from 'contexts/ticketContext';
import { useTicketContext } from 'hooks/useContext';
import { DataLoader } from 'hooks/useDataLoader';
import { ITicketWithHistory } from 'interfaces/useTicketsApi.interface';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TicketDetailPage, TicketDetailPageContent } from './TicketDetailPage';
import { useTicketComment } from './hooks/useTicketComment';

vi.mock('hooks/useContext', () => ({
  useTicketContext: vi.fn()
}));

vi.mock('./hooks/useTicketComment', () => ({
  useTicketComment: vi.fn()
}));

vi.mock('./detail/header/TicketHeader', () => ({
  TicketHeader: ({ ticket }: { ticket: ITicketWithHistory }) => (
    <div data-testid="ticket-header">{ticket.ticket_slug}</div>
  )
}));

vi.mock('./detail/timeline/TicketTimeline', () => ({
  TicketTimeline: ({ history, isLoading }: { history: Array<{ create_date: string }>; isLoading: boolean }) => (
    <div data-testid="ticket-timeline" data-loading={String(isLoading)} data-history={JSON.stringify(history)} />
  )
}));

vi.mock('./detail/comment/TicketComment', () => ({
  TicketComment: ({ comment, isSaving }: { comment: string; isSaving: boolean }) => (
    <div data-testid="ticket-comment" data-comment={comment} data-saving={String(isSaving)} />
  )
}));

vi.mock('./detail/sidebar/TicketSidebar', () => ({
  TicketSidebar: ({ teamId, references }: { teamId?: string; references?: unknown[] }) => (
    <div
      data-testid="ticket-sidebar"
      data-team-id={teamId ?? ''}
      data-reference-count={String(references?.length ?? 0)}
    />
  )
}));

vi.mock('./detail/skeleton/TicketSkeleton', () => ({
  TicketSkeleton: () => <div data-testid="ticket-skeleton" />
}));

const mockUseTicketContext = useTicketContext as Mock;
const mockUseTicketComment = useTicketComment as Mock;

const baseTicket: ITicketWithHistory = {
  ticket_id: '11111111-1111-1111-1111-111111111111',
  ticket_slug: '04900042',
  subject: 'Test Ticket',
  description: 'Test description',
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-02-24T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [
    {
      ticket_status_history_id: 'status-2',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Bob',
      create_date: '2026-02-25T00:00:00.000Z',
      status: 'closed'
    },
    {
      ticket_status_history_id: 'status-1',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Sarah',
      create_date: '2026-02-24T00:00:00.000Z',
      status: 'open'
    }
  ],
  comments: [
    {
      ticket_comment_id: 'comment-1',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      user_identifier: 'Sarah',
      create_date: '2026-02-24T12:00:00.000Z',
      comment: 'New comment'
    }
  ],
  references: [
    {
      ticket_reference_id: 'ref-1',
      source_ticket_id: '11111111-1111-1111-1111-111111111111',
      source_ticket_slug: '04900042',
      source_ticket_subject: 'Test Ticket',
      target_ticket_id: '77777777-7777-7777-7777-777777777777',
      target_ticket_slug: '04900050',
      target_ticket_subject: 'Related ticket',
      relationship: 'relates_to',
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z'
    }
  ]
};

const setComment = vi.fn();
const onAddComment = vi.fn().mockResolvedValue(undefined);

const renderContent = (ticket: ITicketWithHistory | undefined, isLoading = false) =>
  render(
    <TicketDetailPageContent
      ticket={ticket}
      isLoading={isLoading}
      comment="Draft comment"
      setComment={setComment}
      isSavingComment={false}
      onAddComment={onAddComment}
    />
  );

const makeTicketContext = (ticket: ITicketWithHistory | undefined, isLoading = false): ITicketContext => {
  const ticketDataLoader: DataLoader<[string], ITicketWithHistory, unknown> = {
    data: ticket,
    error: undefined,
    isLoading,
    isReady: true,
    load: vi.fn(),
    refresh: vi.fn(),
    clear: vi.fn(),
    setData: vi.fn()
  };

  return {
    ticketId: '11111111-1111-1111-1111-111111111111',
    ticketDataLoader
  };
};

describe('TicketDetailPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, timeline, sidebar, and comment for open tickets', () => {
    renderContent(baseTicket);

    expect(screen.getByTestId('ticket-header')).toHaveTextContent('04900042');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-comment', 'Draft comment');
    expect(screen.getByTestId('ticket-sidebar')).toHaveAttribute('data-team-id', baseTicket.team_id);
    expect(screen.getByTestId('ticket-sidebar')).toHaveAttribute('data-reference-count', '1');
  });

  it('passes chronologically sorted history to timeline', () => {
    renderContent(baseTicket);

    const timeline = screen.getByTestId('ticket-timeline');
    const history = JSON.parse(timeline.getAttribute('data-history') ?? '[]') as Array<{ create_date: string }>;
    const createDates = history.map((entry) => entry.create_date);

    expect(createDates).toEqual(['2026-02-24T00:00:00.000Z', '2026-02-24T12:00:00.000Z', '2026-02-25T00:00:00.000Z']);
    expect(timeline).toHaveAttribute('data-loading', 'false');
  });

  it('hides comment input for closed tickets', () => {
    renderContent({ ...baseTicket, status: 'closed' });

    expect(screen.queryByTestId('ticket-comment')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton when loading and no ticket is available', () => {
    renderContent(undefined, true);

    expect(screen.getByTestId('ticket-skeleton')).toBeVisible();
  });
});

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTicketContext.mockReturnValue(makeTicketContext(baseTicket, false));
    mockUseTicketComment.mockReturnValue({
      comment: 'Hook comment',
      setComment,
      isSavingComment: true,
      handleAddComment: onAddComment
    });
  });

  it('wires context and comment hook state into content rendering', () => {
    render(<TicketDetailPage />);

    expect(screen.getByTestId('ticket-header')).toHaveTextContent('04900042');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-comment', 'Hook comment');
    expect(screen.getByTestId('ticket-comment')).toHaveAttribute('data-saving', 'true');
    expect(screen.getByTestId('ticket-timeline')).toHaveAttribute('data-loading', 'false');
  });
});
