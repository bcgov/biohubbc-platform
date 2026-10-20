// Integration test for admin-only ticket tags, boards, and swimlanes against a real database.
//
// Verifies the set-based SQL that unit tests cannot: board membership (any board tag), lane placement (highest
// sort_order wins, lane tags never add tickets), hidden lanes, replace-set link diffs, cascading soft deletes,
// case-insensitive active-only uniqueness, swimlane reorder/ownership, the admin ticket list tag filter, and that
// portal-facing ticket reads carry no tag data.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted. Because now() is fixed within a
// transaction, all rows written by one test share the same timestamps.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError, ApiNotFoundError } from '../../errors/api-error';
import { HTTPError } from '../../errors/http-error';
import { TicketPriority } from '../../models/ticket';
import { BoardService } from '../../services/board-service';
import { BoardSwimlaneService } from '../../services/board-swimlane-service';
import { TagService } from '../../services/tag-service';
import { TicketService } from '../../services/ticket-service';
import { TicketTagService } from '../../services/ticket-tag-service';

describe('Ticket tags, boards, and swimlanes (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let tagService: TagService;
  let ticketService: TicketService;
  let ticketTagService: TicketTagService;
  let boardService: BoardService;
  let boardSwimlaneService: BoardSwimlaneService;
  let runId: string;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    tagService = new TagService(connection);
    ticketService = new TicketService(connection);
    ticketTagService = new TicketTagService(connection);
    boardService = new BoardService(connection);
    boardSwimlaneService = new BoardSwimlaneService(connection);
    runId = randomUUID().slice(0, 8);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  async function createTag(name: string): Promise<string> {
    const tag = await tagService.createTag({ name: `${name}-${runId}`, description: null, color: '#336699' });
    return tag.tag_id;
  }

  async function createTicket(label: string, tagIds: string[], priority: TicketPriority = 'medium'): Promise<string> {
    const ticket = await ticketService.createTicket({
      subject: `tagboard-${runId}-${label}`,
      description: null,
      priority,
      systemUserIds: []
    });

    if (tagIds.length) {
      await ticketTagService.replaceTicketTags(ticket.ticket_id, tagIds);
    }

    return ticket.ticket_id;
  }

  async function createBoard(tagIds: string[]): Promise<string> {
    const board = await boardService.createBoard({
      name: `Board-${runId}`,
      description: null,
      tagIds
    });
    return board.board_id;
  }

  /**
   * Resolve tag ids to the board's board_tag ids, which is what swimlanes reference.
   */
  async function getBoardTagIds(boardId: string, tagIds: string[]): Promise<string[]> {
    const board = await boardService.getBoard(boardId);
    return tagIds.map((tagId) => board.tags.find((boardTag) => boardTag.tag_id === tagId)!.board_tag_id);
  }

  async function createSwimlane(boardId: string, name: string, tagIds: string[], isVisible = true): Promise<string> {
    const swimlane = await boardSwimlaneService.createBoardSwimlane(boardId, {
      name,
      description: null,
      color: null,
      isVisible,
      boardTagIds: await getBoardTagIds(boardId, tagIds)
    });
    return swimlane.board_swimlane_id;
  }

  async function countActive(table: string, column: string, id: string): Promise<number> {
    const response = await connection.sql(
      SQL`SELECT count(*)::integer AS count FROM `
        .append(table)
        .append(SQL` WHERE `)
        .append(column)
        .append(SQL` = ${id} AND record_end_date IS NULL`)
    );
    return response.rows[0].count;
  }

  /**
   * Flatten a board tickets response into { lane name | 'Unsorted' -> ticket ids } for readable assertions.
   */
  async function boardLayout(boardId: string, includeClosed = false): Promise<Record<string, string[]>> {
    const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: includeClosed });
    const layout: Record<string, string[]> = { Unsorted: boardTickets.unsorted.map((ticket) => ticket.ticket_id) };

    for (const swimlane of boardTickets.swimlanes) {
      layout[swimlane.name] = swimlane.tickets.map((ticket) => ticket.ticket_id);
    }

    return layout;
  }

  describe('board membership and lane placement', () => {
    let fish: string;
    let bird: string;
    let inProgress: string;
    let done: string;
    let other: string;
    let boardId: string;

    beforeEach(async () => {
      [fish, bird, inProgress, done, other] = await Promise.all(
        ['Fish', 'Bird', 'InProgress', 'Done', 'Other'].map((name) => createTag(name))
      );
      boardId = await createBoard([fish, bird, inProgress, done]);
      await createSwimlane(boardId, 'In Progress', [inProgress]);
      await createSwimlane(boardId, 'Done', [done]);
    });

    it('places tickets by any board tag and the highest matching lane', async () => {
      const unsorted = await createTicket('unsorted', [fish]);
      const single = await createTicket('single', [bird, inProgress]);
      const multiple = await createTicket('multiple', [fish, inProgress, done]);
      const laneTagOnly = await createTicket('lane-tag-only', [done]);
      await createTicket('no-board-tag', [other]);
      await createTicket('untagged', []);

      const layout = await boardLayout(boardId);

      expect(layout.Unsorted).to.eql([unsorted]);
      expect(layout['In Progress']).to.eql([single]);
      expect(layout.Done).to.have.members([multiple, laneTagOnly]);
      expect(Object.keys(layout)).to.eql(['Unsorted', 'In Progress', 'Done']);
    });

    it('excludes soft-deleted tags, removed ticket tags, and deleted tickets', async () => {
      const kept = await createTicket('kept', [fish]);
      await createTicket('deleted-tag', [bird]);
      const removedLink = await createTicket('removed-link', [fish]);
      const deletedTicket = await createTicket('deleted-ticket', [fish]);

      await tagService.deleteTag(bird);
      await ticketTagService.replaceTicketTags(removedLink, []);
      await ticketService.deleteTicket(deletedTicket);

      const layout = await boardLayout(boardId);

      expect(layout.Unsorted).to.eql([kept]);
    });

    it('excludes closed tickets unless include_closed is true', async () => {
      const open = await createTicket('open', [fish]);
      const closed = await createTicket('closed', [fish]);
      await ticketService.updateTicket(closed, { status: 'closed' });

      expect((await boardLayout(boardId)).Unsorted).to.eql([open]);
      expect((await boardLayout(boardId, true)).Unsorted).to.have.members([open, closed]);
    });

    it('omits and counts tickets in hidden lanes without moving them to other lanes', async () => {
      const board = await boardService.getBoard(boardId);
      const doneLane = board.swimlanes.find((swimlane) => swimlane.name === 'Done');
      await boardSwimlaneService.updateBoardSwimlane(boardId, doneLane!.board_swimlane_id, {
        name: 'Done',
        description: null,
        color: null,
        isVisible: false,
        boardTagIds: await getBoardTagIds(boardId, [done])
      });
      const inProgressTicket = await createTicket('in-progress', [fish, inProgress]);
      await createTicket('done', [fish, inProgress, done]);

      const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: false });

      expect(boardTickets.swimlanes.map((swimlane) => swimlane.name)).to.eql(['In Progress']);
      expect(boardTickets.swimlanes[0].tickets.map((ticket) => ticket.ticket_id)).to.eql([inProgressTicket]);
      expect(boardTickets.unsorted).to.eql([]);
      expect(boardTickets.hidden_ticket_count).to.equal(1);
    });

    it('orders tickets within a lane by priority, critical first', async () => {
      const low = await createTicket('low', [fish], 'low');
      const critical = await createTicket('critical', [fish], 'critical');
      const high = await createTicket('high', [fish], 'high');

      expect((await boardLayout(boardId)).Unsorted).to.eql([critical, high, low]);
    });

    it('returns each board ticket with its active tags', async () => {
      await createTicket('tagged', [fish, inProgress]);

      const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: false });

      expect(boardTickets.swimlanes[0].tickets[0].tags.map((tag) => tag.tag_id)).to.have.members([fish, inProgress]);
    });
  });

  describe('replace-set links', () => {
    it('soft deletes removed ticket tags, inserts added ones, and leaves unchanged links untouched', async () => {
      const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((name) => createTag(name)));
      const ticketId = await createTicket('replace', [a, b]);
      const before = await connection.sql(
        SQL`SELECT ticket_tag_id FROM ticket_tag WHERE ticket_id = ${ticketId} AND tag_id = ${b}`
      );

      const result = await ticketTagService.replaceTicketTags(ticketId, [b, c]);
      const after = await connection.sql(
        SQL`SELECT ticket_tag_id, record_end_date FROM ticket_tag WHERE ticket_id = ${ticketId} AND tag_id = ${b}`
      );

      expect(result.tags.map((tag) => tag.tag_id)).to.have.members([b, c]);
      expect(after.rows).to.have.length(1);
      expect(after.rows[0].ticket_tag_id).to.equal(before.rows[0].ticket_tag_id);
      expect(after.rows[0].record_end_date).to.be.null;
      expect(result.events.map((event) => `${event.action}:${event.tag_id}`)).to.have.members([
        `added:${a}`,
        `added:${b}`,
        `added:${c}`,
        `removed:${a}`
      ]);
      expect(result.events.every((event) => event.user_identifier !== null)).to.be.true;
    });

    it('re-adding a removed tag creates a new link and keeps the history', async () => {
      const a = await createTag('A');
      const ticketId = await createTicket('readd', [a]);
      await ticketTagService.replaceTicketTags(ticketId, []);

      const result = await ticketTagService.replaceTicketTags(ticketId, [a]);

      expect(result.tags.map((tag) => tag.tag_id)).to.eql([a]);
      expect(result.events.map((event) => event.action)).to.have.members(['added', 'removed', 'added']);
    });

    it('rejects unknown and deleted tags with 400', async () => {
      const a = await createTag('A');
      const ticketId = await createTicket('invalid', []);
      await tagService.deleteTag(a);

      for (const tagIds of [[a], [randomUUID()]]) {
        try {
          await ticketTagService.replaceTicketTags(ticketId, tagIds);
          expect.fail('Expected 400');
        } catch (error) {
          expect((error as HTTPError).status).to.equal(400);
        }
      }
    });

    it('replaces board and lane tag sets without re-inserting unchanged links', async () => {
      const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((name) => createTag(name)));
      const boardId = await createBoard([a, b]);
      const laneId = await createSwimlane(boardId, 'Lane', [a, b]);
      const boardTagBefore = await connection.sql(
        SQL`SELECT board_tag_id FROM board_tag WHERE board_id = ${boardId} AND tag_id = ${b}`
      );

      const board = await boardService.updateBoard(boardId, {
        name: `Board-${runId}`,
        description: null,
        tagIds: [b, c]
      });
      const lane = await boardSwimlaneService.updateBoardSwimlane(boardId, laneId, {
        name: 'Lane',
        description: null,
        color: null,
        isVisible: true,
        boardTagIds: await getBoardTagIds(boardId, [c])
      });
      const boardTagAfter = await connection.sql(
        SQL`SELECT board_tag_id FROM board_tag WHERE board_id = ${boardId} AND tag_id = ${b}`
      );

      expect(board.tags.map((tag) => tag.tag_id)).to.have.members([b, c]);
      // Removing tag a from the board also removed it from the lane, leaving b before the lane update.
      expect(board.swimlanes[0].tags.map((tag) => tag.tag_id)).to.eql([b]);
      expect(lane.tags.map((tag) => tag.tag_id)).to.eql([c]);
      expect(boardTagAfter.rows).to.eql(boardTagBefore.rows);
      expect(await countActive('board_swimlane_tag', 'board_swimlane_id', laneId)).to.equal(1);
    });
  });

  describe('swimlane tags come from the board', () => {
    it('rejects tags that are not on the board, including another board tag', async () => {
      const [a, b] = await Promise.all(['A', 'B'].map((name) => createTag(name)));
      const boardId = await createBoard([a]);
      const otherBoard = await boardService.createBoard({
        name: `Other-${runId}`,
        description: null,
        tagIds: [b]
      });
      const otherBoardTagId = otherBoard.tags[0].board_tag_id;

      for (const boardTagIds of [[otherBoardTagId], [randomUUID()]]) {
        try {
          await boardSwimlaneService.createBoardSwimlane(boardId, {
            name: 'Lane',
            description: null,
            color: null,
            isVisible: true,
            boardTagIds
          });
          expect.fail('Expected 400');
        } catch (error) {
          expect((error as HTTPError).status).to.equal(400);
        }
      }

      expect(await countActive('board_swimlane', 'board_id', boardId)).to.equal(0);
    });

    it('re-adding a tag to the board does not restore it on lanes', async () => {
      const a = await createTag('A');
      const boardId = await createBoard([a]);
      const laneId = await createSwimlane(boardId, 'Lane', [a]);
      const boardRequest = { name: `Board-${runId}`, description: null };

      await boardService.updateBoard(boardId, { ...boardRequest, tagIds: [] });
      const board = await boardService.updateBoard(boardId, { ...boardRequest, tagIds: [a] });

      expect(board.tags.map((tag) => tag.tag_id)).to.eql([a]);
      expect(board.swimlanes.find((swimlane) => swimlane.board_swimlane_id === laneId)!.tags).to.eql([]);
      // The lane link itself is ended, not just hidden by the inactive board tag.
      expect(await countActive('board_swimlane_tag', 'board_swimlane_id', laneId)).to.equal(0);
    });
  });

  describe('cascading soft deletes', () => {
    it('deleting a tag removes its ticket, board, and lane links', async () => {
      const a = await createTag('A');
      await createTicket('cascade', [a]);
      const boardId = await createBoard([a]);
      const laneId = await createSwimlane(boardId, 'Lane', [a]);

      await tagService.deleteTag(a);

      expect(await countActive('ticket_tag', 'tag_id', a)).to.equal(0);
      expect(await countActive('board_tag', 'tag_id', a)).to.equal(0);
      expect(await countActive('board_swimlane_tag', 'board_swimlane_id', laneId)).to.equal(0);
      expect(await countActive('tag', 'tag_id', a)).to.equal(0);
    });

    it('deleting a board removes its tags, lanes, and lane tags', async () => {
      const a = await createTag('A');
      const boardId = await createBoard([a]);
      const laneId = await createSwimlane(boardId, 'Lane', [a]);

      await boardService.deleteBoard(boardId);

      expect(await countActive('board_tag', 'board_id', boardId)).to.equal(0);
      expect(await countActive('board_swimlane', 'board_id', boardId)).to.equal(0);
      expect(await countActive('board_swimlane_tag', 'board_swimlane_id', laneId)).to.equal(0);
      expect(await countActive('board', 'board_id', boardId)).to.equal(0);
      expect(await countActive('tag', 'tag_id', a)).to.equal(1);
    });

    it('deleting a lane removes only its lane tags', async () => {
      const a = await createTag('A');
      const boardId = await createBoard([a]);
      const laneId = await createSwimlane(boardId, 'Lane', [a]);

      await boardSwimlaneService.deleteBoardSwimlane(boardId, laneId);

      expect(await countActive('board_swimlane_tag', 'board_swimlane_id', laneId)).to.equal(0);
      expect(await countActive('board_swimlane', 'board_swimlane_id', laneId)).to.equal(0);
      expect(await countActive('board_tag', 'board_id', boardId)).to.equal(1);
    });

    it('deleting a ticket removes its ticket tags', async () => {
      const a = await createTag('A');
      const ticketId = await createTicket('cascade', [a]);

      await ticketService.deleteTicket(ticketId);

      expect(await countActive('ticket_tag', 'ticket_id', ticketId)).to.equal(0);
    });
  });

  describe('uniqueness', () => {
    it('rejects duplicate active tag and board names case-insensitively', async () => {
      await tagService.createTag({ name: `Fish-${runId}`, description: null, color: '#000000' });
      await createBoard([]);

      try {
        await tagService.createTag({ name: `FISH-${runId}`, description: null, color: '#000000' });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      try {
        await boardService.createBoard({ name: `BOARD-${runId}`, description: null, tagIds: [] });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });

    it('allows a deleted tag, board, and lane name to be recreated', async () => {
      const tag = await tagService.createTag({ name: `Fish-${runId}`, description: null, color: '#000000' });
      await tagService.deleteTag(tag.tag_id);
      const boardId = await createBoard([]);
      const laneId = await createSwimlane(boardId, 'Lane', []);
      await boardSwimlaneService.deleteBoardSwimlane(boardId, laneId);
      await createSwimlane(boardId, 'LANE', []);
      await boardService.deleteBoard(boardId);

      const recreatedTag = await tagService.createTag({ name: `fish-${runId}`, description: null, color: '#000000' });
      const recreatedBoardId = await createBoard([]);

      expect(recreatedTag.tag_id).to.not.equal(tag.tag_id);
      expect(recreatedBoardId).to.not.equal(boardId);
    });

    it('enforces active tag name uniqueness in the database', async () => {
      await tagService.createTag({ name: `Fish-${runId}`, description: null, color: '#000000' });

      try {
        await connection.sql(SQL`INSERT INTO tag (name, color) VALUES (${`fIsH-${runId}`}, '#000000')`);
        expect.fail('Expected unique violation');
      } catch (error) {
        expect(String((error as Error).message) + JSON.stringify(error)).to.match(/tag_nuk1|duplicate|unique/i);
      }
    });
  });

  describe('swimlanes', () => {
    it('appends new lanes and rewrites sort_order on reorder', async () => {
      const boardId = await createBoard([]);
      const first = await createSwimlane(boardId, 'First', []);
      const second = await createSwimlane(boardId, 'Second', []);
      const third = await createSwimlane(boardId, 'Third', []);

      const reordered = await boardSwimlaneService.reorderBoardSwimlanes(boardId, [third, first, second]);

      expect(reordered.map((swimlane) => [swimlane.board_swimlane_id, swimlane.sort_order])).to.eql([
        [third, 0],
        [first, 1],
        [second, 2]
      ]);
    });

    it('rejects reorders with missing or foreign lanes and lanes from another board', async () => {
      const boardId = await createBoard([]);
      const lane = await createSwimlane(boardId, 'Lane', []);
      const otherBoard = await boardService.createBoard({
        name: `Other-${runId}`,
        description: null,
        tagIds: []
      });
      const foreignLane = await createSwimlane(otherBoard.board_id, 'Foreign', []);

      for (const order of [[], [lane, foreignLane], [foreignLane]]) {
        try {
          await boardSwimlaneService.reorderBoardSwimlanes(boardId, order);
          expect.fail('Expected 400');
        } catch (error) {
          expect((error as HTTPError).status).to.equal(400);
        }
      }

      try {
        await boardSwimlaneService.deleteBoardSwimlane(boardId, foreignLane);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(await countActive('board_swimlane', 'board_swimlane_id', foreignLane)).to.equal(1);
    });
  });

  describe('admin ticket list', () => {
    it('board_id filter returns only tickets with any of the board tags', async () => {
      const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((name) => createTag(name)));
      const boardId = await createBoard([a, b]);
      const withA = await createTicket('board-a', [a]);
      const withB = await createTicket('board-b', [b, c]);
      await createTicket('board-c', [c]);
      await createTicket('board-none', []);
      const search = `tagboard-${runId}`;

      const filtered = await ticketService.getTicketsWithTags({ search, board_id: boardId });
      const filteredCount = await ticketService.getTicketsCount({ search, board_id: boardId });

      expect(filtered.map((ticket) => ticket.ticket_id)).to.have.members([withA, withB]);
      expect(filteredCount).to.equal(2);
    });

    it('tag_ids filter returns only tickets with any of the tags', async () => {
      const [a, b, c] = await Promise.all(['A', 'B', 'C'].map((name) => createTag(name)));
      const withA = await createTicket('with-a', [a]);
      const withB = await createTicket('with-b', [b, c]);
      await createTicket('with-c', [c]);
      await createTicket('untagged', []);
      const search = `tagboard-${runId}`;

      const filtered = await ticketService.getTicketsWithTags({ search, tag_ids: [a, b] });
      const filteredCount = await ticketService.getTicketsCount({ search, tag_ids: [a, b] });
      const unfilteredCount = await ticketService.getTicketsCount({ search });
      const emptyFilter = await ticketService.getTicketsWithTags({ search, tag_ids: [] });

      expect(filtered.map((ticket) => ticket.ticket_id)).to.have.members([withA, withB]);
      expect(filteredCount).to.equal(2);
      expect(unfilteredCount).to.equal(4);
      expect(emptyFilter).to.eql([]);
      expect(filtered.find((ticket) => ticket.ticket_id === withB)!.tags.map((tag) => tag.tag_id)).to.have.members([
        b,
        c
      ]);
    });

    it('team_ids filter returns only tickets of the team', async () => {
      const first = await createTicket('team-first', []);
      await createTicket('team-second', []);
      const firstTicket = await ticketService.getTicket(first);

      const filtered = await ticketService.getTicketsWithTags({
        search: `tagboard-${runId}`,
        team_ids: [firstTicket.team_id]
      });

      expect(filtered.map((ticket) => ticket.ticket_id)).to.eql([first]);
    });
  });

  describe('board tags', () => {
    it('creating a tag on a board creates a regular tag and adds it to the board', async () => {
      const boardId = await createBoard([]);

      const tag = await boardService.createBoardTag(boardId, {
        name: `Board tag-${runId}`,
        description: null,
        color: '#123456'
      });

      expect((await boardService.getBoard(boardId)).tags.map((boardTag) => boardTag.tag_id)).to.eql([tag.tag_id]);
      expect((await tagService.getTags({ search: `Board tag-${runId}` })).map((found) => found.tag_id)).to.eql([
        tag.tag_id
      ]);
    });

    it('rejects a duplicate tag name without changing the board', async () => {
      const boardId = await createBoard([]);
      await createTag('Taken');

      try {
        await boardService.createBoardTag(boardId, { name: `TAKEN-${runId}`, description: null, color: '#123456' });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect((await boardService.getBoard(boardId)).tags).to.eql([]);
    });
  });

  describe('tag and board lists', () => {
    it('board_id filter returns only the board tags, with pagination and count', async () => {
      const [a, b] = await Promise.all(['A', 'B', 'C'].map((name) => createTag(name)));
      const boardId = await createBoard([a, b]);

      const firstPage = await tagService.getTags({ board_id: boardId }, { page: 1, limit: 1 });
      const secondPage = await tagService.getTags({ board_id: boardId }, { page: 2, limit: 1 });
      const count = await tagService.getTagsCount({ board_id: boardId });

      expect([...firstPage, ...secondPage].map((tag) => tag.tag_id)).to.have.members([a, b]);
      expect(firstPage).to.have.length(1);
      expect(count).to.equal(2);
      expect(await tagService.getTagsCount({ board_id: boardId, search: `C-${runId}` })).to.equal(0);
      expect(await tagService.getTagsCount({ search: `C-${runId}` })).to.equal(1);
    });

    it('lists boards by search with pagination and count', async () => {
      await createBoard([]);
      await boardService.createBoard({ name: `Other-${runId}`, description: null, tagIds: [] });

      const boards = await boardService.getBoards({ search: runId }, { page: 1, limit: 1 });
      const count = await boardService.getBoardsCount({ search: runId });

      expect(boards).to.have.length(1);
      expect(count).to.equal(2);
    });
  });

  describe('portal isolation', () => {
    it('shared ticket detail and the portal list carry no tag data or tag events', async () => {
      const a = await createTag('A');
      const ticketId = await createTicket('portal', [a]);
      await ticketTagService.replaceTicketTags(ticketId, []);
      await ticketTagService.replaceTicketTags(ticketId, [a]);

      const detail = await ticketService.getTicket(ticketId);
      const portalList = await ticketService.getTickets({ search: `tagboard-${runId}` });
      const serializedDetail = JSON.stringify(detail);

      expect(detail).to.not.have.any.keys('tags', 'events', 'tag_events');
      expect(serializedDetail).to.not.include(a);
      expect(serializedDetail).to.not.include(`A-${runId}`);
      expect(portalList).to.have.length(1);
      expect(portalList[0]).to.not.have.property('tags');
    });
  });
});
