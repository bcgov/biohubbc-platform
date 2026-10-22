// Integration test for admin-only ticket tags, boards, and swimlanes against a real database.
//
// Verifies the SQL and constraints that unit tests cannot: a ticket is on a board at most once and in exactly one of
// that board's lanes, moving and removing board tickets, hidden lanes, cascading soft deletes, replace-set tag link
// diffs, case-insensitive active-only uniqueness, swimlane reorder/ownership and paging, the admin ticket list tag
// filter, that tags are independent of boards, and that portal-facing ticket reads carry no tag data.
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

  async function createBoard(label = 'Board'): Promise<string> {
    const board = await boardService.createBoard({ name: `${label}-${runId}`, description: null });
    return board.board_id;
  }

  async function getToDoLane(boardId: string): Promise<string> {
    const board = await boardService.getBoard(boardId);
    return board.swimlanes.find((swimlane) => swimlane.name === 'To Do')!.board_swimlane_id;
  }

  async function createSwimlane(boardId: string, name: string): Promise<string> {
    const swimlane = await boardSwimlaneService.createBoardSwimlane(boardId, { name, description: null, color: null });
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
   * Flatten a board tickets response into { 'All' | lane name -> ticket ids } for readable assertions.
   */
  async function boardLayout(boardId: string, includeClosed = false): Promise<Record<string, string[]>> {
    const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: includeClosed });
    const layout: Record<string, string[]> = { All: boardTickets.tickets.map((ticket) => ticket.ticket_id) };

    for (const swimlane of boardTickets.swimlanes) {
      layout[swimlane.name] = swimlane.tickets.map((ticket) => ticket.ticket_id);
    }

    return layout;
  }

  describe('board tickets', () => {
    let boardId: string;
    let doing: string;
    let done: string;

    beforeEach(async () => {
      boardId = await createBoard();
      doing = await createSwimlane(boardId, 'Doing');
      done = await createSwimlane(boardId, 'Done');
    });

    it('puts a ticket on a board in one lane, and moves it between lanes without touching its tags', async () => {
      const fish = await createTag('Fish');
      const ticketId = await createTicket('moved', [fish]);

      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });
      expect(await boardLayout(boardId)).to.eql({ All: [ticketId], 'To Do': [], Doing: [ticketId], Done: [] });

      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: done });
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: done });

      expect(await boardLayout(boardId)).to.eql({ All: [ticketId], 'To Do': [], Doing: [], Done: [ticketId] });
      expect(await countActive('board_ticket', 'ticket_id', ticketId)).to.equal(1);
      expect((await ticketTagService.getTicketTags(ticketId)).tags.map((tag) => tag.tag_id)).to.eql([fish]);
    });

    it('puts a ticket on many boards, once each', async () => {
      const otherBoardId = await createBoard('Other');
      const otherLane = await createSwimlane(otherBoardId, 'Backlog');
      const ticketId = await createTicket('many-boards', []);

      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });
      await boardService.ensureBoardTicket(otherBoardId, ticketId, { boardSwimlaneId: otherLane });

      expect((await boardLayout(boardId)).Doing).to.eql([ticketId]);
      expect((await boardLayout(otherBoardId)).Backlog).to.eql([ticketId]);
      expect(await countActive('board_ticket', 'ticket_id', ticketId)).to.equal(2);
    });

    it("rejects another board's lane, which the database also refuses", async () => {
      const otherBoardId = await createBoard('Other');
      const otherLane = await createSwimlane(otherBoardId, 'Backlog');
      const ticketId = await createTicket('foreign-lane', []);

      try {
        await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: otherLane });
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      try {
        await connection.sql(
          SQL`INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id) VALUES (${boardId}, ${ticketId}, ${otherLane})`
        );
        expect.fail('Expected foreign key violation');
      } catch (error) {
        expect(String((error as Error).message) + JSON.stringify(error)).to.match(
          /board_ticket_board_swimlane_fk|foreign key/i
        );
      }
    });

    it('enforces one active row per ticket per board in the database', async () => {
      const ticketId = await createTicket('one-row', []);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });

      try {
        await connection.sql(
          SQL`INSERT INTO board_ticket (board_id, ticket_id, board_swimlane_id) VALUES (${boardId}, ${ticketId}, ${done})`
        );
        expect.fail('Expected unique violation');
      } catch (error) {
        expect(String((error as Error).message) + JSON.stringify(error)).to.match(
          /board_ticket_nuk1|duplicate|unique/i
        );
      }
    });

    it('takes a ticket off a board, and taking it off again changes nothing', async () => {
      const ticketId = await createTicket('removed', []);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });

      await boardService.deleteBoardTicket(boardId, ticketId);
      await boardService.deleteBoardTicket(boardId, ticketId);

      expect(await boardLayout(boardId)).to.eql({ All: [], 'To Do': [], Doing: [], Done: [] });
      expect(await countActive('ticket', 'ticket_id', ticketId)).to.equal(1);
    });

    it('reorders tickets within a lane and puts a moved ticket at a position in another lane', async () => {
      const first = await createTicket('first', []);
      const second = await createTicket('second', []);
      const third = await createTicket('third', []);
      for (const ticketId of [first, second, third]) {
        await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });
      }
      const doneTicket = await createTicket('done', []);
      await boardService.ensureBoardTicket(boardId, doneTicket, { boardSwimlaneId: done });

      await boardService.ensureBoardTicket(boardId, third, { boardSwimlaneId: doing, position: 0 });
      expect((await boardLayout(boardId)).Doing).to.eql([third, first, second]);

      await boardService.ensureBoardTicket(boardId, first, { boardSwimlaneId: done, position: 0 });
      await boardService.ensureBoardTicket(boardId, second, { boardSwimlaneId: done, position: 99 });
      const layout = await boardLayout(boardId);
      expect(layout.Doing).to.eql([third]);
      expect(layout.Done).to.eql([first, doneTicket, second]);
    });

    it('creates a ticket on the board in its default lane, To Do', async () => {
      const created = await boardService.createBoardTicket(boardId, {
        subject: `tagboard-${runId}-created`,
        description: null,
        priority: 'medium'
      });

      expect((await boardLayout(boardId))['To Do']).to.eql([created.ticket_id]);
    });

    it('keeps a lane visible when it is edited', async () => {
      await connection.sql(SQL`UPDATE board_swimlane SET is_visible = false WHERE board_swimlane_id = ${done}`);

      const edited = await boardSwimlaneService.updateBoardSwimlane(boardId, done, {
        name: 'Finished',
        description: null,
        color: null
      });

      expect([edited.name, edited.is_visible]).to.eql(['Finished', false]);
    });

    it('rejects a default lane of another board in the database', async () => {
      const otherLane = await createSwimlane(await createBoard('Other'), 'Backlog');

      try {
        await connection.sql(SQL`UPDATE board SET default_swimlane_id = ${otherLane} WHERE board_id = ${boardId}`);
        expect.fail('Expected foreign key violation');
      } catch (error) {
        expect(String((error as Error).message) + JSON.stringify(error)).to.match(
          /board_default_swimlane_fk|foreign key/i
        );
      }
    });

    it('puts a ticket added without a lane in To Do, and leaves a ticket already on the board in its lane', async () => {
      const added = await createTicket('added', []);
      const moved = await createTicket('moved', []);
      await boardService.ensureBoardTicket(boardId, moved, { boardSwimlaneId: done });

      await boardService.ensureBoardTicket(boardId, added, {});
      await boardService.ensureBoardTicket(boardId, moved, {});

      const layout = await boardLayout(boardId);
      expect(layout['To Do']).to.eql([added]);
      expect(layout.Done).to.eql([moved]);
    });

    it('excludes closed tickets unless include_closed is true', async () => {
      const open = await createTicket('open', []);
      const closed = await createTicket('closed', []);
      await boardService.ensureBoardTicket(boardId, open, { boardSwimlaneId: doing });
      await boardService.ensureBoardTicket(boardId, closed, { boardSwimlaneId: doing });
      await ticketService.updateTicket(closed, { status: 'closed' });

      expect((await boardLayout(boardId)).Doing).to.eql([open]);
      expect((await boardLayout(boardId, true)).Doing).to.have.members([open, closed]);
    });

    it('returns hidden lanes with their tickets', async () => {
      const hidden = await createSwimlane(boardId, 'Hidden');
      // Lanes are created visible and the API does not hide them yet, so the lane is hidden directly.
      await connection.sql(SQL`UPDATE board_swimlane SET is_visible = false WHERE board_swimlane_id = ${hidden}`);
      const ticketId = await createTicket('hidden', []);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: hidden });

      const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: false });

      expect(boardTickets.swimlanes.map((swimlane) => [swimlane.name, swimlane.is_visible])).to.eql([
        ['To Do', true],
        ['Doing', true],
        ['Done', true],
        ['Hidden', false]
      ]);
      expect(boardTickets.swimlanes[3].tickets.map((ticket) => ticket.ticket_id)).to.eql([ticketId]);
      expect(boardTickets.tickets.map((ticket) => ticket.ticket_id)).to.eql([ticketId]);
    });

    it('orders tickets within a lane oldest first, whatever their priority, each with its active tags', async () => {
      const fish = await createTag('Fish');
      const oldest = await createTicket('oldest', [fish], 'low');
      const newest = await createTicket('newest', [], 'critical');
      const middle = await createTicket('middle', [], 'high');
      // Rows written in one transaction share now(), so the tickets are given distinct creation times.
      const createDates: [string, string][] = [
        [oldest, '2026-01-01T00:00:00Z'],
        [middle, '2026-02-01T00:00:00Z'],
        [newest, '2026-03-01T00:00:00Z']
      ];
      for (const [ticketId, createDate] of createDates) {
        await connection.sql(SQL`UPDATE ticket SET create_date = ${createDate} WHERE ticket_id = ${ticketId}`);
        await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });
      }

      const boardTickets = await boardService.getBoardTickets(boardId, { include_closed: false });
      const doingTickets = boardTickets.swimlanes.find((swimlane) => swimlane.name === 'Doing')!.tickets;

      expect(doingTickets.map((ticket) => ticket.ticket_id)).to.eql([oldest, middle, newest]);
      expect(boardTickets.tickets.map((ticket) => ticket.ticket_id)).to.eql([oldest, middle, newest]);
      expect(doingTickets[0].tags.map((tag) => tag.tag_id)).to.eql([fish]);
    });

    it('keeps tags independent of boards: changing or deleting tags leaves board tickets in place', async () => {
      const fish = await createTag('Fish');
      const ticketId = await createTicket('tags-independent', [fish]);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: doing });

      await ticketTagService.replaceTicketTags(ticketId, []);
      await tagService.deleteTag(fish);

      expect((await boardLayout(boardId)).Doing).to.eql([ticketId]);
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
  });

  describe('board tags', () => {
    let boardId: string;
    let fish: string;

    beforeEach(async () => {
      boardId = await createBoard();
      fish = await createTag('Fish');
    });

    it("puts a ticket on a board, last in its default lane, when it gets one of the board's tags", async () => {
      await boardService.ensureBoardTag(boardId, fish);
      const earlier = await createTicket('earlier', []);
      await boardService.ensureBoardTicket(boardId, earlier, {});
      const tagged = await createTicket('tagged', []);
      await createTicket('untagged', [await createTag('Other')]);

      await ticketTagService.replaceTicketTags(tagged, [fish]);

      expect((await boardLayout(boardId))['To Do']).to.eql([earlier, tagged]);
    });

    it('does not put back a ticket taken off the board when its tags are saved again', async () => {
      await boardService.ensureBoardTag(boardId, fish);
      const ticketId = await createTicket('removed', [fish]);
      await boardService.deleteBoardTicket(boardId, ticketId);

      await ticketTagService.replaceTicketTags(ticketId, [fish, await createTag('Bird')]);

      expect((await boardLayout(boardId)).All).to.eql([]);
    });

    it('puts the tickets that already have a tag on the board when the tag is linked, once', async () => {
      const first = await createTicket('first', [fish]);
      const second = await createTicket('second', [fish]);
      await createTicket('other', []);

      await boardService.ensureBoardTag(boardId, fish);

      expect((await boardLayout(boardId))['To Do']).to.have.members([first, second]);

      await boardService.deleteBoardTicket(boardId, first);
      await boardService.ensureBoardTag(boardId, fish);

      expect((await boardLayout(boardId))['To Do']).to.eql([second]);
      expect(await countActive('board_tag', 'board_id', boardId)).to.equal(1);
    });

    it('lists the board tags, and unlinking one takes off the tickets no other board tag keeps on', async () => {
      const bird = await createTag('Bird');
      await boardService.ensureBoardTag(boardId, fish);
      await boardService.ensureBoardTag(boardId, bird);
      const removed = await createTicket('removed', [fish]);
      const kept = await createTicket('kept', [fish, bird]);
      const added = await createTicket('added', []);
      await boardService.ensureBoardTicket(boardId, added, {});
      const otherBoardId = await createBoard('Other');
      await boardService.ensureBoardTag(otherBoardId, fish);

      expect((await tagService.getTags({ board_id: boardId })).map((tag) => tag.tag_id)).to.have.members([fish, bird]);

      await boardService.deleteBoardTag(boardId, fish);

      expect((await tagService.getTags({ board_id: boardId })).map((tag) => tag.tag_id)).to.eql([bird]);
      expect((await boardLayout(boardId))['To Do']).to.eql([kept, added]);
      expect((await boardLayout(otherBoardId))['To Do']).to.have.members([removed, kept]);
      expect(await countActive('tag', 'tag_id', fish)).to.equal(1);
    });

    it('unlinking a tag that is not linked leaves the board tickets', async () => {
      const ticketId = await createTicket('added', [fish]);
      await boardService.ensureBoardTicket(boardId, ticketId, {});

      await boardService.deleteBoardTag(boardId, fish);

      expect((await boardLayout(boardId))['To Do']).to.eql([ticketId]);
    });

    it('takes a ticket off the boards of the tags it loses, unless another of its tags keeps it on', async () => {
      const bird = await createTag('Bird');
      const keptBoardId = await createBoard('Kept');
      await boardService.ensureBoardTag(boardId, fish);
      await boardService.ensureBoardTag(keptBoardId, fish);
      await boardService.ensureBoardTag(keptBoardId, bird);
      const ticketId = await createTicket('loses', [fish, bird]);
      const untagged = await createTicket('untagged', []);
      await boardService.ensureBoardTicket(boardId, untagged, {});

      await ticketTagService.replaceTicketTags(ticketId, [bird]);

      expect((await boardLayout(boardId)).All).to.eql([untagged]);
      expect((await boardLayout(keptBoardId)).All).to.eql([ticketId]);

      await ticketTagService.replaceTicketTags(ticketId, []);

      expect((await boardLayout(keptBoardId)).All).to.eql([]);
    });

    it('keeps a ticket on a board when a lost tag is swapped for another tag linked to it', async () => {
      const bird = await createTag('Bird');
      await boardService.ensureBoardTag(boardId, fish);
      await boardService.ensureBoardTag(boardId, bird);
      const ticketId = await createTicket('swapped', [fish]);
      const laneId = await createSwimlane(boardId, 'Doing');
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: laneId });

      await ticketTagService.replaceTicketTags(ticketId, [bird]);

      expect((await boardLayout(boardId)).Doing).to.eql([ticketId]);
    });

    it('takes the tickets of a deleted tag off its boards, unless another of their tags keeps them on', async () => {
      const bird = await createTag('Bird');
      await boardService.ensureBoardTag(boardId, fish);
      await boardService.ensureBoardTag(boardId, bird);
      const removed = await createTicket('removed', [fish]);
      const kept = await createTicket('kept', [fish, bird]);

      await tagService.deleteTag(fish);

      expect((await boardLayout(boardId)).All).to.eql([kept]);
      expect(await countActive('board_ticket', 'ticket_id', removed)).to.equal(0);
    });

    it('creates a tag linked to the board', async () => {
      const tag = await boardService.createBoardTag(boardId, {
        name: `Board tag-${runId}`,
        description: null,
        color: '#123456'
      });

      expect((await tagService.getTags({ board_id: boardId })).map((boardTag) => boardTag.tag_id)).to.eql([tag.tag_id]);
    });

    it('ends board links when the tag or the board is deleted', async () => {
      await boardService.ensureBoardTag(boardId, fish);
      const bird = await createTag('Bird');
      await boardService.ensureBoardTag(boardId, bird);

      await tagService.deleteTag(fish);
      expect(await countActive('board_tag', 'tag_id', fish)).to.equal(0);

      await boardService.deleteBoard(boardId);
      expect(await countActive('board_tag', 'board_id', boardId)).to.equal(0);
    });
  });

  describe('cascading soft deletes', () => {
    it('deleting a tag removes its ticket links', async () => {
      const a = await createTag('A');
      await createTicket('cascade', [a]);

      await tagService.deleteTag(a);

      expect(await countActive('ticket_tag', 'tag_id', a)).to.equal(0);
      expect(await countActive('tag', 'tag_id', a)).to.equal(0);
    });

    it('deleting a board takes its tickets off it and deletes its lanes, but not the tickets', async () => {
      const boardId = await createBoard();
      const laneId = await createSwimlane(boardId, 'Lane');
      const ticketId = await createTicket('board-deleted', []);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: laneId });

      await boardService.deleteBoard(boardId);

      expect(await countActive('board_ticket', 'board_id', boardId)).to.equal(0);
      expect(await countActive('board_swimlane', 'board_id', boardId)).to.equal(0);
      expect(await countActive('board', 'board_id', boardId)).to.equal(0);
      expect(await countActive('ticket', 'ticket_id', ticketId)).to.equal(1);
    });

    it('refuses to delete a lane with tickets, and deletes it once they are moved', async () => {
      const boardId = await createBoard();
      const laneId = await createSwimlane(boardId, 'Lane');
      const otherLaneId = await createSwimlane(boardId, 'Other');
      const ticketId = await createTicket('lane-deleted', []);
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: laneId });

      try {
        await boardService.deleteBoardSwimlane(boardId, laneId);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: otherLaneId });
      await boardService.deleteBoardSwimlane(boardId, laneId);

      expect(await countActive('board_swimlane', 'board_swimlane_id', laneId)).to.equal(0);
      expect((await boardLayout(boardId)).Other).to.eql([ticketId]);
    });

    it('deleting a ticket removes its ticket tags and takes it off its boards', async () => {
      const a = await createTag('A');
      const ticketId = await createTicket('cascade', [a]);
      const boardId = await createBoard();
      const laneId = await createSwimlane(boardId, 'Lane');
      await boardService.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: laneId });

      await ticketService.deleteTicket(ticketId);

      expect(await countActive('ticket_tag', 'ticket_id', ticketId)).to.equal(0);
      expect(await countActive('board_ticket', 'ticket_id', ticketId)).to.equal(0);
    });
  });

  describe('uniqueness', () => {
    it('rejects duplicate active tag and board names case-insensitively', async () => {
      await tagService.createTag({ name: `Fish-${runId}`, description: null, color: '#000000' });
      await createBoard();

      try {
        await tagService.createTag({ name: `FISH-${runId}`, description: null, color: '#000000' });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      try {
        await boardService.createBoard({ name: `BOARD-${runId}`, description: null });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });

    it('allows a deleted tag, board, and lane name to be recreated', async () => {
      const tag = await tagService.createTag({ name: `Fish-${runId}`, description: null, color: '#000000' });
      await tagService.deleteTag(tag.tag_id);
      const boardId = await createBoard();
      const laneId = await createSwimlane(boardId, 'Lane');
      await boardService.deleteBoardSwimlane(boardId, laneId);
      await createSwimlane(boardId, 'LANE');
      await boardService.deleteBoard(boardId);

      const recreatedTag = await tagService.createTag({ name: `fish-${runId}`, description: null, color: '#000000' });
      const recreatedBoardId = await createBoard();

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
    it('starts every board with a visible To Do lane as its default, which can be deleted like any lane', async () => {
      const boardId = await createBoard();
      const board = await boardService.getBoard(boardId);

      expect(board.swimlanes.map((swimlane) => [swimlane.name, swimlane.sort_order, swimlane.is_visible])).to.eql([
        ['To Do', 0, true]
      ]);
      expect(board.default_swimlane_id).to.equal(board.swimlanes[0].board_swimlane_id);

      await boardService.deleteBoardSwimlane(boardId, board.swimlanes[0].board_swimlane_id);

      const laneless = await boardService.getBoard(boardId);
      expect(laneless.swimlanes).to.eql([]);
      expect(laneless.default_swimlane_id).to.be.null;

      try {
        await boardService.ensureBoardTicket(boardId, await createTicket('no-default', []), {});
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });

    it('appends new lanes after To Do and rewrites sort_order on reorder', async () => {
      const boardId = await createBoard();
      const toDo = await getToDoLane(boardId);
      const first = await createSwimlane(boardId, 'First');
      const second = await createSwimlane(boardId, 'Second');

      const reordered = await boardSwimlaneService.reorderBoardSwimlanes(boardId, [second, toDo, first]);

      expect(reordered.map((swimlane) => [swimlane.board_swimlane_id, swimlane.sort_order])).to.eql([
        [second, 0],
        [toDo, 1],
        [first, 2]
      ]);
    });

    it('creates and edits lanes at a sort order, keeping it when none is given', async () => {
      const boardId = await createBoard();
      const right = await boardSwimlaneService.createBoardSwimlane(boardId, {
        name: 'Right',
        description: null,
        color: null,
        sortOrder: 10
      });
      const appended = await createSwimlane(boardId, 'Appended');

      expect(right.sort_order).to.equal(10);
      expect((await boardService.getBoard(boardId)).swimlanes.map((swimlane) => swimlane.name)).to.eql([
        'To Do',
        'Right',
        'Appended'
      ]);

      const moved = await boardSwimlaneService.updateBoardSwimlane(boardId, right.board_swimlane_id, {
        name: 'Right',
        description: null,
        color: null,
        sortOrder: 99
      });
      const kept = await boardSwimlaneService.updateBoardSwimlane(boardId, appended, {
        name: 'Appended',
        description: null,
        color: null
      });

      expect([moved.sort_order, kept.sort_order]).to.eql([99, 11]);
    });

    it("pages a board's lanes in display order and counts them", async () => {
      const boardId = await createBoard();
      const toDo = await getToDoLane(boardId);
      const first = await createSwimlane(boardId, 'First');
      const second = await createSwimlane(boardId, 'Second');
      await boardSwimlaneService.reorderBoardSwimlanes(boardId, [second, first, toDo]);

      const firstPage = await boardSwimlaneService.getPaginatedBoardSwimlanes(boardId, { page: 1, limit: 2 });
      const secondPage = await boardSwimlaneService.getPaginatedBoardSwimlanes(boardId, { page: 2, limit: 2 });

      expect(firstPage.map((swimlane) => swimlane.board_swimlane_id)).to.eql([second, first]);
      expect(secondPage.map((swimlane) => swimlane.board_swimlane_id)).to.eql([toDo]);
      expect(await boardSwimlaneService.getBoardSwimlanesCount(boardId)).to.equal(3);
    });

    it('rejects reorders with missing or foreign lanes and lanes from another board', async () => {
      const boardId = await createBoard();
      const lane = await createSwimlane(boardId, 'Lane');
      const otherBoard = await boardService.createBoard({ name: `Other-${runId}`, description: null });
      const foreignLane = await createSwimlane(otherBoard.board_id, 'Foreign');

      for (const order of [[], [lane, foreignLane], [foreignLane]]) {
        try {
          await boardSwimlaneService.reorderBoardSwimlanes(boardId, order);
          expect.fail('Expected 400');
        } catch (error) {
          expect((error as HTTPError).status).to.equal(400);
        }
      }

      try {
        await boardService.deleteBoardSwimlane(boardId, foreignLane);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(await countActive('board_swimlane', 'board_swimlane_id', foreignLane)).to.equal(1);
    });
  });

  describe('admin ticket list', () => {
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

  describe('board lists', () => {
    it('lists boards by search with pagination and count', async () => {
      await createBoard();
      await boardService.createBoard({ name: `Other-${runId}`, description: null });

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
