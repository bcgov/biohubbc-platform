import { Knex } from 'knex';

/**
 * Seed ticket domain mock data.
 *
 * Idempotent: safe to run multiple times.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA 'biohub';
    SET SEARCH_PATH = 'biohub','public';
  `);

  const createUserRow = await knex('system_user').whereNull('record_end_date').select('system_user_id').first();
  const createUser = createUserRow?.system_user_id ?? 1;

  let teamRow = await knex('team').whereNull('record_end_date').select('team_id').orderBy('create_date', 'asc').first();

  if (!teamRow) {
    const [createdTeam] = await knex('team')
      .insert({
        name: 'Seed Ticket Team',
        description: 'Auto-created team for seeded ticket data',
        create_user: createUser
      })
      .returning(['team_id']);

    teamRow = createdTeam;
  }

  const teamId = teamRow.team_id;

  // Create two representative tickets
  const openTicket = await ensureTicket(knex, {
    title: 'Seed Ticket - Open Review',
    description: 'Open ticket used for admin ticket list and timeline testing.',
    priority: 'MEDIUM',
    status: 'OPEN',
    teamId,
    createUser
  });

  const closedTicket = await ensureTicket(knex, {
    title: 'Seed Ticket - Closed Review',
    description: 'Closed ticket used for admin ticket list and status history testing.',
    priority: 'HIGH',
    status: 'CLOSED',
    teamId,
    createUser
  });

  await ensureTicketStatusHistory(knex, openTicket.ticket_id, 'OPEN', createUser);
  await ensureTicketStatusHistory(knex, closedTicket.ticket_id, 'OPEN', createUser);
  await ensureTicketStatusHistory(knex, closedTicket.ticket_id, 'CLOSED', createUser);

  const openComment = await ensureComment(knex, 'Seed comment for open ticket.', createUser);
  const closedComment = await ensureComment(knex, 'Seed comment for closed ticket.', createUser);

  await ensureTicketComment(knex, openTicket.ticket_id, openComment.comment_id, createUser);
  await ensureTicketComment(knex, closedTicket.ticket_id, closedComment.comment_id, createUser);

  await ensureTicketReference(knex, openTicket.ticket_id, closedTicket.ticket_id, 'RELATES_TO', createUser);

  await ensureTicketDecision(knex, openTicket.ticket_id, 'PENDING', openComment.comment_id, createUser);
  await ensureTicketDecision(knex, closedTicket.ticket_id, 'APPROVED', closedComment.comment_id, createUser);

  // Seed one data_request and add a decision row
  const dataRequest = await ensureDataRequest(knex, teamId, createUser);
  await ensureDataRequestDecision(knex, dataRequest.data_request_id, 'PENDING', openComment.comment_id, createUser);

  // Seed one submission upload decision row (if any submission uploads exist)
  const submissionUpload = await knex('submission_upload').select('submission_upload_id').first();

  if (submissionUpload) {
    await ensureSubmissionUploadDecision(
      knex,
      submissionUpload.submission_upload_id,
      'PENDING',
      openComment.comment_id,
      createUser
    );
  }
}

type TicketStatus = 'OPEN' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type DecisionType = 'APPROVED' | 'DENIED' | 'PENDING';
type TicketRelationshipType =
  | 'BLOCKS'
  | 'BLOCKED_BY'
  | 'DUPLICATES'
  | 'DUPLICATE_OF'
  | 'RELATES_TO'
  | 'RESOLVES'
  | 'RESOLVED_BY';

interface ITicketSeedInput {
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  teamId: string;
  createUser: number;
}

/**
 * Ensure a ticket exists with the specified title.
 */
const ensureTicket = async (
  knex: Knex,
  input: ITicketSeedInput
): Promise<{ ticket_id: string; status: TicketStatus }> => {
  const existing = await knex('ticket').where({ title: input.title }).whereNull('record_end_date').first();

  if (existing) {
    if (existing.status !== input.status) {
      await knex('ticket').where({ ticket_id: existing.ticket_id }).update({ status: input.status });
    }

    return { ticket_id: existing.ticket_id, status: input.status };
  }

  const [created] = await knex('ticket')
    .insert({
      ticket_short_id: await generateUniqueTicketShortId(knex),
      title: input.title,
      description: input.description,
      team_id: input.teamId,
      priority: input.priority,
      status: input.status,
      create_user: input.createUser
    })
    .returning(['ticket_id', 'status']);

  return created;
};

/**
 * Generate an unused DDDNNNNN ticket short ID.
 */
const generateUniqueTicketShortId = async (knex: Knex): Promise<string> => {
  const now = new Date();
  const utcYearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayOfYear = Math.floor((utcToday - utcYearStart) / (1000 * 60 * 60 * 24));
  const dayPrefix = dayOfYear.toString().padStart(3, '0');

  for (let attempts = 0; attempts < 50; attempts++) {
    const randomDigits = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0');
    const candidate = `${dayPrefix}${randomDigits}`;

    const existing = await knex('ticket').where({ ticket_short_id: candidate }).first();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique ticket_short_id for seed data');
};

/**
 * Ensure status history row exists for ticket + status pair.
 */
const ensureTicketStatusHistory = async (
  knex: Knex,
  ticketId: string,
  status: TicketStatus,
  createUser: number
): Promise<void> => {
  const existing = await knex('ticket_status_history')
    .where({ ticket_id: ticketId, status })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('ticket_status_history').insert({
    ticket_id: ticketId,
    status,
    create_user: createUser
  });
};

/**
 * Ensure a comment exists with the given comment text.
 */
const ensureComment = async (knex: Knex, comment: string, createUser: number): Promise<{ comment_id: string }> => {
  const existing = await knex('comment').where({ comment }).first();

  if (existing) {
    return { comment_id: existing.comment_id };
  }

  const [created] = await knex('comment').insert({ comment, create_user: createUser }).returning(['comment_id']);
  return created;
};

/**
 * Ensure ticket_comment link exists.
 */
const ensureTicketComment = async (
  knex: Knex,
  ticketId: string,
  commentId: string,
  createUser: number
): Promise<void> => {
  const existing = await knex('ticket_comment')
    .where({ ticket_id: ticketId, comment_id: commentId })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('ticket_comment').insert({
    ticket_id: ticketId,
    comment_id: commentId,
    create_user: createUser
  });
};

/**
 * Ensure a ticket reference exists.
 */
const ensureTicketReference = async (
  knex: Knex,
  sourceTicketId: string,
  targetTicketId: string,
  relationship: TicketRelationshipType,
  createUser: number
): Promise<void> => {
  const existing = await knex('ticket_reference')
    .where({
      source_ticket_id: sourceTicketId,
      target_ticket_id: targetTicketId,
      relationship
    })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('ticket_reference').insert({
    source_ticket_id: sourceTicketId,
    target_ticket_id: targetTicketId,
    relationship,
    create_user: createUser
  });
};

/**
 * Ensure an active ticket decision exists.
 */
const ensureTicketDecision = async (
  knex: Knex,
  ticketId: string,
  decision: DecisionType,
  commentId: string,
  createUser: number
): Promise<void> => {
  const existing = await knex('ticket_decision').where({ ticket_id: ticketId }).whereNull('record_end_date').first();

  if (existing) {
    return;
  }

  await knex('ticket_decision').insert({
    ticket_id: ticketId,
    decision,
    comment_id: commentId,
    create_user: createUser
  });
};

/**
 * Ensure a data_request exists for seeded ticket timeline testing.
 */
const ensureDataRequest = async (
  knex: Knex,
  teamId: string,
  createUser: number
): Promise<{ data_request_id: string }> => {
  const reason = 'Seed data request for ticket domain testing';

  const existing = await knex('data_request').where({ reason }).whereNull('record_end_date').first();

  if (existing) {
    return { data_request_id: existing.data_request_id };
  }

  const [created] = await knex('data_request')
    .insert({
      reason,
      team_id: teamId,
      requested_by: createUser,
      create_user: createUser
    })
    .returning(['data_request_id']);

  return created;
};

/**
 * Ensure an active data_request decision exists.
 */
const ensureDataRequestDecision = async (
  knex: Knex,
  dataRequestId: string,
  decision: DecisionType,
  commentId: string,
  createUser: number
): Promise<void> => {
  const existing = await knex('data_request_decision')
    .where({ data_request_id: dataRequestId })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('data_request_decision').insert({
    data_request_id: dataRequestId,
    decision,
    comment_id: commentId,
    create_user: createUser
  });
};

/**
 * Ensure an active submission_upload decision exists.
 */
const ensureSubmissionUploadDecision = async (
  knex: Knex,
  submissionUploadId: string,
  decision: DecisionType,
  commentId: string,
  createUser: number
): Promise<void> => {
  const existing = await knex('submission_upload_decision')
    .where({ submission_upload_id: submissionUploadId })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('submission_upload_decision').insert({
    submission_upload_id: submissionUploadId,
    decision,
    comment_id: commentId,
    create_user: createUser
  });
};
