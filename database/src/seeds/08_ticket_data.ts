import { Knex } from 'knex';

type TicketStatus = 'open' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type TicketRelationshipType =
  | 'blocks'
  | 'blocked_by'
  | 'duplicates'
  | 'duplicate_of'
  | 'relates_to'
  | 'resolves'
  | 'resolved_by';

interface TicketScenario {
  key: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  currentStatus: TicketStatus;
  statusTimeline: TicketStatus[];
  comments: string[];
}

interface TicketReferenceScenario {
  sourceKey: string;
  targetKey: string;
  relationship: TicketRelationshipType;
}

interface EnsureTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  teamId: string;
  createUser: number;
}

const TICKET_SCENARIOS: TicketScenario[] = [
  {
    key: 'ops-check',
    subject: 'Ops Health Check',
    description: 'Validate baseline ticket workflow behavior for active operations tickets.',
    priority: 'medium',
    currentStatus: 'open',
    statusTimeline: ['open'],
    comments: ['[Ticket Seed] Ops triage started.', '[Ticket Seed] Awaiting confirmation from support owner.']
  },
  {
    key: 'data-fix',
    subject: 'Data Correction',
    description: 'Track correction of a known metadata inconsistency in a historical record.',
    priority: 'high',
    currentStatus: 'closed',
    statusTimeline: ['open', 'closed'],
    comments: ['[Ticket Seed] Root cause isolated.', '[Ticket Seed] Fix applied and verified.']
  },
  {
    key: 'security-review',
    subject: 'Security Review',
    description: 'Coordinate follow-up actions from a routine security review checklist.',
    priority: 'critical',
    currentStatus: 'open',
    statusTimeline: ['open'],
    comments: ['[Ticket Seed] Findings captured for remediation planning.', '[Ticket Seed] Engineering owner assigned.']
  },
  {
    key: 'duplicate-cleanup',
    subject: 'Duplicate Cleanup',
    description: 'Resolve duplicate issue reports and consolidate into canonical tracking.',
    priority: 'low',
    currentStatus: 'closed',
    statusTimeline: ['open', 'closed'],
    comments: ['[Ticket Seed] Duplicate records merged and references updated.']
  }
];

const TICKET_REFERENCE_SCENARIOS: TicketReferenceScenario[] = [
  {
    sourceKey: 'security-review',
    targetKey: 'ops-check',
    relationship: 'blocks'
  },
  {
    sourceKey: 'duplicate-cleanup',
    targetKey: 'data-fix',
    relationship: 'duplicates'
  },
  {
    sourceKey: 'ops-check',
    targetKey: 'data-fix',
    relationship: 'relates_to'
  }
];

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

  const createUser = await getSeedCreateUser(knex);
  const teamId = await getOrCreateSeedTeam(knex, createUser);

  const seededTicketsByKey: Record<string, { ticket_id: string; status: TicketStatus }> = {};

  for (const scenario of TICKET_SCENARIOS) {
    const ticket = await ensureTicket(knex, {
      subject: scenario.subject,
      description: scenario.description,
      priority: scenario.priority,
      status: scenario.currentStatus,
      teamId,
      createUser
    });

    seededTicketsByKey[scenario.key] = ticket;

    await ensureStatusTimeline(knex, ticket.ticket_id, scenario.statusTimeline, createUser);

    for (const commentText of scenario.comments) {
      const comment = await ensureComment(knex, commentText, createUser);
      await ensureTicketComment(knex, ticket.ticket_id, comment.comment_id, createUser);
    }
  }

  // Seed data_request records linked to tickets
  const opsCheckTicket = seededTicketsByKey['ops-check'];
  const dataFixTicket = seededTicketsByKey['data-fix'];

  if (opsCheckTicket) {
    await ensureDataRequest(knex, {
      reason: 'Ops health check data request',
      teamId,
      requestedBy: createUser,
      ticketId: opsCheckTicket.ticket_id
    });
  }

  if (dataFixTicket) {
    await ensureDataRequest(knex, {
      reason: 'Data correction data request',
      teamId,
      requestedBy: createUser,
      ticketId: dataFixTicket.ticket_id
    });
  }

  for (const referenceScenario of TICKET_REFERENCE_SCENARIOS) {
    const sourceTicket = seededTicketsByKey[referenceScenario.sourceKey];
    const targetTicket = seededTicketsByKey[referenceScenario.targetKey];

    if (!sourceTicket || !targetTicket) {
      continue;
    }

    await ensureTicketReference(
      knex,
      sourceTicket.ticket_id,
      targetTicket.ticket_id,
      referenceScenario.relationship,
      createUser
    );
  }
}

const getSeedCreateUser = async (knex: Knex): Promise<number> => {
  const createUserRow = await knex('system_user').whereNull('record_end_date').select('system_user_id').first();
  return createUserRow?.system_user_id ?? 1;
};

const getOrCreateSeedTeam = async (knex: Knex, createUser: number): Promise<string> => {
  const existingTeam = await knex('team')
    .where('name', 'Seed Ticket Team')
    .whereNull('record_end_date')
    .select('team_id')
    .first();

  if (existingTeam) {
    return existingTeam.team_id;
  }

  const [createdTeam] = await knex('team')
    .insert({
      name: 'Seed Ticket Team',
      description: 'Auto-created team for seeded ticket data.',
      create_user: createUser
    })
    .returning(['team_id']);

  return createdTeam.team_id;
};

const ensureTicket = async (
  knex: Knex,
  input: EnsureTicketInput
): Promise<{ ticket_id: string; status: TicketStatus }> => {
  const existing = await knex('ticket').where({ subject: input.subject }).whereNull('record_end_date').first();

  if (existing) {
    await knex('ticket').where({ ticket_id: existing.ticket_id }).update({
      description: input.description,
      priority: input.priority,
      status: input.status,
      team_id: input.teamId
    });

    return { ticket_id: existing.ticket_id, status: input.status };
  }

  const [created] = await knex('ticket')
    .insert({
      ticket_slug: await generateUniqueTicketSlug(knex),
      subject: input.subject,
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
 * Generate an unused DDDNNNNN ticket slug using the next available
 * sequence for the current UTC day.
 */
const generateUniqueTicketSlug = async (knex: Knex): Promise<string> => {
  const now = new Date();
  const utcYearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayOfYear = Math.floor((utcToday - utcYearStart) / (1000 * 60 * 60 * 24));
  const dayPrefix = dayOfYear.toString().padStart(3, '0');

  const rows = await knex('ticket')
    .whereRaw('LEFT(ticket_slug, 3) = ?', [dayPrefix])
    .select<{ ticket_slug: string }[]>('ticket_slug');

  const usedSlugs = new Set(rows.map((row) => row.ticket_slug));

  for (let sequence = 0; sequence <= 99999; sequence++) {
    const candidate = `${dayPrefix}${sequence.toString().padStart(5, '0')}`;

    if (!usedSlugs.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique ticket_slug for seed data');
};

const ensureStatusTimeline = async (
  knex: Knex,
  ticketId: string,
  statuses: TicketStatus[],
  createUser: number
): Promise<void> => {
  for (const status of statuses) {
    await ensureTicketStatus(knex, ticketId, status, createUser);
  }
};

const ensureTicketStatus = async (
  knex: Knex,
  ticketId: string,
  status: TicketStatus,
  createUser: number
): Promise<void> => {
  const existing = await knex('ticket_status')
    .where({ ticket_id: ticketId, status })
    .whereNull('record_end_date')
    .first();

  if (existing) {
    return;
  }

  await knex('ticket_status').insert({
    ticket_id: ticketId,
    status,
    create_user: createUser
  });
};

const ensureComment = async (knex: Knex, comment: string, createUser: number): Promise<{ comment_id: string }> => {
  const existing = await knex('comment').where({ comment }).first();

  if (existing) {
    return { comment_id: existing.comment_id };
  }

  const [created] = await knex('comment').insert({ comment, create_user: createUser }).returning(['comment_id']);
  return created;
};

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

const ensureDataRequest = async (
  knex: Knex,
  input: { reason: string; teamId: string; requestedBy: number; ticketId: string }
): Promise<void> => {
  const existing = await knex('data_request').where({ ticket_id: input.ticketId }).whereNull('record_end_date').first();

  let dataRequestId: string;

  if (existing) {
    dataRequestId = existing.data_request_id;
    const hasStatus = await knex('data_request_status')
      .where({ data_request_id: dataRequestId })
      .whereNull('record_end_date')
      .first();
    if (hasStatus) {
      return;
    }
  } else {
    const [inserted] = await knex('data_request')
      .insert({
        reason: input.reason,
        team_id: input.teamId,
        requested_by: input.requestedBy,
        ticket_id: input.ticketId,
        create_user: input.requestedBy
      })
      .returning(['data_request_id']);
    dataRequestId = inserted.data_request_id;
  }

  await knex('data_request_status').insert({
    data_request_id: dataRequestId,
    request_status: 'APPROVED',
    comment_id: null,
    create_user: input.requestedBy
  });
};
