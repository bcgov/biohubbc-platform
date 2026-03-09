import { z } from 'zod';

export const TicketRelationshipType = z.enum([
  'blocks',
  'blocked_by',
  'duplicates',
  'duplicate_of',
  'relates_to',
  'resolves',
  'resolved_by'
]);

export type TicketRelationshipType = z.infer<typeof TicketRelationshipType>;

export const TicketReference = z.object({
  ticket_reference_id: z.string().uuid(),
  source_ticket_id: z.string().uuid(),
  source_ticket_slug: z.string().regex(/^\d{8}$/),
  source_ticket_subject: z.string(),
  target_ticket_id: z.string().uuid(),
  target_ticket_slug: z.string().regex(/^\d{8}$/),
  target_ticket_subject: z.string(),
  relationship: TicketRelationshipType,
  user_identifier: z.string(),
  create_date: z.string()
});

export type TicketReference = z.infer<typeof TicketReference>;

export const CreateTicketReference = z.object({
  source_ticket_id: z.string().uuid(),
  target_ticket_id: z.string().uuid(),
  relationship: TicketRelationshipType
});

export type CreateTicketReference = z.infer<typeof CreateTicketReference>;

export const CreateTicketReferenceRequest = z.object({
  target_ticket_id: z.string().uuid(),
  relationship: TicketRelationshipType
});

export type CreateTicketReferenceRequest = z.infer<typeof CreateTicketReferenceRequest>;
