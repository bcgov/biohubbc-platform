import chai from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { TicketArtifact } from '../models/ticket-artifact';
import { TicketArtifactRepository } from './ticket-artifact-repository';

chai.use(sinonChai);

describe('TicketArtifactRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTicketArtifacts', () => {
    const mockTicketId = '11111111-1111-1111-1111-111111111111';
    const mockArtifactIds: string[] = ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'];

    it('returns early when no artifact ids are provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.insertTicketArtifacts(mockTicketId, []);

      chai.expect(result).to.eql([]);
    });

    it('executes insert query and returns active ticket artifacts', async () => {
      const rows: TicketArtifact[] = [
        {
          ticket_artifact_id: '11111111-1111-1111-8111-111111111111',
          ticket_id: mockTicketId,
          artifact_id: mockArtifactIds[0],
          record_end_date: null,
          create_date: '2026-04-29T00:00:00.000Z',
          object_key: 'tickets/abc/file.txt'
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows, 1));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.insertTicketArtifacts(mockTicketId, mockArtifactIds);

      chai.expect(result).to.eql(rows);
    });
  });

  describe('findTicketArtifactById', () => {
    it('returns one active ticket artifact by ticket_artifact_id', async () => {
      const row: TicketArtifact = {
        ticket_artifact_id: '11111111-1111-1111-8111-111111111111',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        artifact_id: '22222222-2222-2222-8222-222222222222',
        record_end_date: null,
        create_date: '2026-04-29T00:00:00.000Z',
        object_key: 'tickets/abc/file.txt'
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.findTicketArtifactById('11111111-1111-1111-1111-111111111111', row.ticket_artifact_id);

      chai.expect(result).to.eql(row);
    });

    it('returns null when no active ticket artifact is found', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.findTicketArtifactById(
        '11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-8111-111111111111'
      );

      chai.expect(result).to.equal(null);
    });
  });

  describe('getTicketArtifacts', () => {
    it('returns active ticket artifacts with keys', async () => {
      const rows: TicketArtifact[] = [
        {
          ticket_artifact_id: '11111111-1111-1111-8111-111111111111',
          ticket_id: '11111111-1111-1111-1111-111111111111',
          artifact_id: '22222222-2222-2222-8222-222222222222',
          record_end_date: null,
          create_date: '2026-04-29T00:00:00.000Z',
          object_key: 'tickets/abc/file.txt'
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows, 1));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.getTicketArtifacts('11111111-1111-1111-1111-111111111111');

      chai.expect(result).to.eql(rows);
    });

    it('accepts optional pagination', async () => {
      const rows: TicketArtifact[] = [
        {
          ticket_artifact_id: '11111111-1111-1111-8111-111111111111',
          ticket_id: '11111111-1111-1111-1111-111111111111',
          artifact_id: '22222222-2222-2222-8222-222222222222',
          record_end_date: null,
          create_date: '2026-04-29T00:00:00.000Z',
          object_key: 'tickets/abc/file.txt'
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows, 1));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.getTicketArtifacts(
        '11111111-1111-1111-1111-111111111111',
        { search: 'file' },
        {
          page: 1,
          limit: 10,
          sort: 'create_date',
          order: 'desc'
        }
      );

      chai.expect(result).to.eql(rows);
    });
  });

  describe('getTicketArtifactsCount', () => {
    it('returns active ticket artifact count', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([{ count: 3 }], 1));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketArtifactRepository(mockDBConnection);

      const result = await repo.getTicketArtifactsCount('11111111-1111-1111-1111-111111111111');

      chai.expect(result).to.equal(3);
    });
  });
});
