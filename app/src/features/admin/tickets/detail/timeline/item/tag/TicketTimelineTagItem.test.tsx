import { ITicketTagEvent } from 'interfaces/useTagsApi.interface';
import { render, screen } from 'test-helpers/test-utils';
import { TicketTimelineTagItem } from './TicketTimelineTagItem';

const tagEvent: ITicketTagEvent = {
  ticket_tag_id: '11111111-1111-4111-8111-111111111111',
  tag_id: '22222222-2222-4222-8222-222222222222',
  tag_name: 'Urgent',
  tag_color: '#D8292F',
  action: 'added',
  user_identifier: 'sarah',
  tag_rule_name: null,
  event_date: '2026-10-02T00:00:00.000Z'
};

describe('TicketTimelineTagItem', () => {
  it('names the user who added a tag by hand', () => {
    render(<TicketTimelineTagItem tagEvent={tagEvent} dateLabel="1 day ago" />);

    expect(screen.getByText('Urgent')).toBeVisible();
    expect(screen.getByText('added by sarah')).toBeVisible();
  });

  it('names the rule that added a tag', () => {
    render(
      <TicketTimelineTagItem
        tagEvent={{ ...tagEvent, user_identifier: null, tag_rule_name: 'Failed uploads' }}
        dateLabel="1 day ago"
      />
    );

    expect(screen.getByText("added by rule 'Failed uploads'")).toBeVisible();
  });

  it('names the user who removed a rule-applied tag', () => {
    render(
      <TicketTimelineTagItem
        tagEvent={{ ...tagEvent, action: 'removed', tag_rule_name: 'Failed uploads' }}
        dateLabel="1 day ago"
      />
    );

    expect(screen.getByText('removed by sarah')).toBeVisible();
  });
});
