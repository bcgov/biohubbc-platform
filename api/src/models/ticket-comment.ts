import { z } from 'zod';
import { TicketArtifact } from './ticket-artifact';

export const TicketComment = z.object({
  ticket_comment_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  user_identifier: z.string(),
  create_date: z.string(),
  comment: z.string(),
  artifacts: z.array(TicketArtifact)
});

export type TicketComment = z.infer<typeof TicketComment>;

export const CreateTicketCommentRequest = z.object({
  comment: z.string().min(1).max(3000)
});

export type CreateTicketCommentRequest = z.infer<typeof CreateTicketCommentRequest>;

export const UpdateTicketCommentRequest = z.object({
  comment: z.string().min(1).max(3000)
});

export type UpdateTicketCommentRequest = z.infer<typeof UpdateTicketCommentRequest>;

export const CreateTicketComment = z.object({
  ticketId: z.string().uuid(),
  comment: z.string().min(1).max(3000)
});

export type CreateTicketComment = z.infer<typeof CreateTicketComment>;

export const UpdateTicketComment = z.object({
  ticketId: z.string().uuid(),
  ticketCommentId: z.string().uuid(),
  comment: z.string().min(1).max(3000)
});

export type UpdateTicketComment = z.infer<typeof UpdateTicketComment>;
