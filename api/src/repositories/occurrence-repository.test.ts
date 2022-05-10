import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { QueryResult } from 'pg';
import { IPostOccurrenceData, OccurrenceRepository } from './occurrence-repository';

chai.use(sinonChai);

describe.only('OccurrenceRepository', () => {
  describe('uploadScrapedOccurrence', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockParams = {
      associatedTaxa: 'associatedTaxa',
      lifeStage: 'lifeStage',
      sex: 'sex',
      individualCount: 'individualCount',
      vernacularName: 'vernacularName',
      data: 'data',
      verbatimCoordinates: 'verbatimCoordinates',
      organismQuantity: 'organismQuantity',
      organismQuantityType: 'organismQuantityType',
      eventDate: 'eventDate'
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      try {
        await occurrenceRepository.uploadScrapedOccurrence(1, (mockParams as unknown) as IPostOccurrenceData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert occurrence data');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      const response = await occurrenceRepository.uploadScrapedOccurrence(
        1,
        (mockParams as unknown) as IPostOccurrenceData
      );

      expect(response.occurrence_id).to.equal(1);
    });
  });

  describe('getOccurrenceSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockResponse = {
      associatedTaxa: 'associatedTaxa',
      lifeStage: 'lifeStage',
      sex: 'sex',
      individualCount: 'individualCount',
      vernacularName: 'vernacularName',
      verbatimCoordinates: 'verbatimCoordinates',
      organismQuantity: 'organismQuantity',
      organismQuantityType: 'organismQuantityType',
      eventDate: 'eventDate'
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      try {
        await occurrenceRepository.getOccurrenceSubmission(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get occurrence record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [mockResponse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      const response = await occurrenceRepository.getOccurrenceSubmission(1);

      expect(response).to.equal(mockResponse);
    });
  });
});
