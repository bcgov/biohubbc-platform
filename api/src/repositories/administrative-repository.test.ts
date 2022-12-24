import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { AdministrativeRepository, IAdministrativeActivity } from './administrative-repository';

chai.use(sinonChai);

describe('AdministrativeRepository', () => {
  describe('getAdministrativeActivities', async () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      try {
        await administrativeRepository.getAdministrativeActivities('string', ['string']);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to get Administrative activities');
      }
    });

    it('should return rows if succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ id: 1 } as unknown as IAdministrativeActivity]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.getAdministrativeActivities('string', ['string']);

      expect(result).to.be.eql([{ id: 1 }]);
    });
  });

  describe('checkIfAccessRequestIsApproval', async () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should return false if request is not Approved', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.checkIfAccessRequestIsApproval(1);

      expect(result).to.eql(false);
    });

    it('should return true if request is Approved', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ name: 'Actioned' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.checkIfAccessRequestIsApproval(1);

      expect(result).to.be.eql(true);
    });
  });

  describe('createAdministrativeActivity', async () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      try {
        await administrativeRepository.createAdministrativeActivity(1, ['string']);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to submit administrative activity');
      }
    });

    it('should return rows if succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ id: 1 } as unknown as IAdministrativeActivity]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.createAdministrativeActivity(1, ['string']);

      expect(result).to.be.eql({ id: 1 });
    });
  });

  describe('getPendingAccessRequestCount', async () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should return 0 if no requests found', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.getPendingAccessRequestCount('string');
      expect(result).to.be.eql(0);
    });

    it('should return number of requests found', async () => {
      const mockQueryResponse = {
        rowCount: 2
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.getPendingAccessRequestCount('string');

      expect(result).to.be.eql(2);
    });
  });

  describe('updateAdministrativeActivity', async () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      try {
        await administrativeRepository.updateAdministrativeActivity(1, 1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to update administrative activity');
      }
    });

    it('should return rows if succeeds', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ id: 1 } as unknown as IAdministrativeActivity]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const administrativeRepository = new AdministrativeRepository(mockDBConnection);

      const result = await administrativeRepository.updateAdministrativeActivity(1, 1);

      expect(result).to.be.eql({ id: 1 });
    });
  });
});
