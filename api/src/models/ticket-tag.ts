import { z } from 'zod';
import { TagSummary } from './tag';

/**
 * A ticket's active tag, with the rule that applied it. Rule-applied tags are ordinary tags that admins can remove.
 */
export const TicketTagSummary = TagSummary.extend({
  tag_rule_id: z.string().uuid().nullable(),
  tag_rule_name: z.string().nullable()
});
export type TicketTagSummary = z.infer<typeof TicketTagSummary>;

export const TicketTagEventAction = z.enum(['added', 'removed']);
export type TicketTagEventAction = z.infer<typeof TicketTagEventAction>;

/**
 * A tag added to or removed from a ticket, derived from ticket_tag create and soft-delete audit columns.
 * Admin timeline only; never returned by portal endpoints.
 */
export const TicketTagEvent = z.object({
  ticket_tag_id: z.string().uuid(),
  tag_id: z.string().uuid(),
  tag_name: z.string(),
  tag_color: z.string(),
  action: TicketTagEventAction,
  user_identifier: z.string().nullable(),
  tag_rule_name: z.string().nullable(),
  event_date: z.string()
});
export type TicketTagEvent = z.infer<typeof TicketTagEvent>;

export interface TicketTags {
  tags: TicketTagSummary[];
  events: TicketTagEvent[];
}
