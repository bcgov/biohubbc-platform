import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { QueryResult } from 'pg';
import { IPostOccurrenceData, OccurrenceRepository } from './occurrence-repository';
import SQL from 'sql-template-strings';

chai.use(sinonChai);

describe('OccurrenceRepository', () => {
  describe('insertScrapedOccurrence', () => {
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
        await occurrenceRepository.insertScrapedOccurrence(1, (mockParams as unknown) as IPostOccurrenceData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert occurrence data');
      }
    });

    it('should not append geography to insertData object if utm invalid', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const getUtm = sinon.stub(OccurrenceRepository.prototype, 'getGeographySqlFromUtm').returns(SQL`test`);

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      await occurrenceRepository.insertScrapedOccurrence(1, ({
        ...mockParams,
        verbatimCoordinates: 'test'
      } as unknown) as IPostOccurrenceData);

      expect(getUtm).to.not.be.called;
    });

    it('should append geography to insertData object if utm valid', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const getUtm = sinon.stub(OccurrenceRepository.prototype, 'getGeographySqlFromUtm').returns(SQL`test`);

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      await occurrenceRepository.insertScrapedOccurrence(1, ({
        ...mockParams,
        verbatimCoordinates: '9N 573674 6114170'
      } as unknown) as IPostOccurrenceData);

      expect(getUtm).to.be.calledOnce;
    });

    it('should not append geography to insertData object if latLong invalid', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const getLatLong = sinon.stub(OccurrenceRepository.prototype, 'getGeographySqlFromLatLong').returns(SQL`test`);

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      await occurrenceRepository.insertScrapedOccurrence(1, ({
        ...mockParams,
        verbatimCoordinates: 'test'
      } as unknown) as IPostOccurrenceData);

      expect(getLatLong).to.not.be.called;
    });

    it('should append geography to insertData object if latLong valid', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const getLatLong = sinon.stub(OccurrenceRepository.prototype, 'getGeographySqlFromLatLong').returns(SQL`test`);

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      await occurrenceRepository.insertScrapedOccurrence(1, ({
        ...mockParams,
        verbatimCoordinates: '49.116906 -122.62887'
      } as unknown) as IPostOccurrenceData);

      expect(getLatLong).to.be.calledOnce;
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ occurrence_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      const response = await occurrenceRepository.insertScrapedOccurrence(
        1,
        (mockParams as unknown) as IPostOccurrenceData
      );

      expect(response.occurrence_id).to.equal(1);
    });
  });

  describe('getGeography', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('from UTM', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      const mockUtm = { easting: 1, northing: 2, zone_srid: 3, zone_letter: 'a', zone_number: 4 };

      const response = occurrenceRepository.getGeographySqlFromUtm(mockUtm);

      expect(response).to.eql(SQL`
    public.ST_Transform(
      public.ST_SetSRID(
        public.ST_MakePoint(${1}, ${2}),
        ${3}
      ),
      4326
    )`);
    });

    it('from LatLong', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceRepository = new OccurrenceRepository(mockDBConnection);

      const mockLatLong = { long: 1, lat: 2 };

      const response = occurrenceRepository.getGeographySqlFromLatLong(mockLatLong);

      expect(response).to.eql(SQL`
    public.ST_Transform(
      public.ST_SetSRID(
        public.ST_MakePoint(${1}, ${2}),
        4326
      ),
      4326
    )`);
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
