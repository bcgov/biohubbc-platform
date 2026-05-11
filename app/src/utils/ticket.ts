import { ITicketExtended } from 'interfaces/useTicketsApi.interface';

export const normalizeExtendedTicket = (ticket: ITicketExtended): ITicketExtended => ({
  ...ticket,
  statuses: ticket.statuses ?? [],
  comments: ticket.comments ?? [],
  artifacts: ticket.artifacts ?? [],
  references: ticket.references ?? [],
  data_requests: ticket.data_requests ?? [],
  submission_uploads: (ticket.submission_uploads ?? []).map((upload) => ({
    ...upload,
    reviews: upload.reviews ?? []
  })),
  ticket_system_users: ticket.ticket_system_users ?? []
});
