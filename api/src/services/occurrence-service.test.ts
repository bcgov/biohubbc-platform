import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { getMockDBConnection } from '../__mocks__/db';
import { DwCAOccurrenceHeaders, DwCAOccurrenceRows, OccurrenceService } from './occurrence-service';

chai.use(sinonChai);

describe('OccurrenceService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getOccurrenceSubmission', () => {
    it('should return Occurrence Submission on get', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const repo = sinon
        .stub(OccurrenceRepository.prototype, 'getOccurrenceSubmission')
        .resolves(({ occurrenceId: 1 } as unknown) as IGetOccurrenceData);

      const response = await occurrenceService.getOccurrenceSubmission(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ occurrenceId: 1 });
    });
  });

  describe('insertScrapedOccurrence', () => {
    it('should return occurrence_id on upload', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const repo = sinon.stub(OccurrenceRepository.prototype, 'insertScrapedOccurrence').resolves({ occurrence_id: 1 });

      const response = await occurrenceService.insertScrapedOccurrence(1, ({} as unknown) as IPostOccurrenceData);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ occurrence_id: 1 });
    });
  });

  describe('scrapeAndUploadOccurrences', () => {
    it('returns an array of occurrence_id', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const getHeadersAndRowsFromFileStub = sinon
        .stub(OccurrenceService.prototype, 'getHeadersAndRowsFromFile')
        .returns({ rows: {} as any, headers: {} as any });

      const scrapeOccurrencesStub = sinon
        .stub(OccurrenceService.prototype, 'scrapeOccurrences')
        .returns([{} as any, {} as any, {} as any]);

      sinon
        .stub(OccurrenceService.prototype, 'insertScrapedOccurrence')
        .onCall(0)
        .resolves({ occurrence_id: 1 })
        .onCall(1)
        .resolves({ occurrence_id: 2 })
        .onCall(2)
        .resolves({ occurrence_id: 3 })
        .onCall(3)
        .resolves({ occurrence_id: 4 });

      const response = await occurrenceService.scrapeAndUploadOccurrences(1, ({} as unknown) as DWCArchive);

      expect(getHeadersAndRowsFromFileStub).to.have.been.calledOnce;
      expect(scrapeOccurrencesStub).to.have.been.calledOnce;

      expect(response).to.be.eql([{ occurrence_id: 1 }, { occurrence_id: 2 }, { occurrence_id: 3 }]);
    });
  });

  describe('scrapeOccurrences', () => {
    it('returns an empty array', () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const response = occurrenceService.scrapeOccurrences(
        ({ occurrenceRows: [] } as unknown) as DwCAOccurrenceRows,
        ({} as unknown) as DwCAOccurrenceHeaders
      );

      expect(response).to.eql([]);
    });

    it('returns an array with no event or taxo data', () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const mockRows = {
        eventRows: [['0', '1', '2', '3', '4', '5', '6', '7']],
        occurrenceRows: [['0', '1', '2', '3', '4', '5', '6', '7']],
        taxonRows: [['0', '1', '2', '3', '4', '5', '6', '7']]
      };

      const mockHeaders = {
        eventHeaders: ['eventHeader'],
        eventIdHeader: 10,
        eventVerbatimCoordinatesHeader: 2,
        eventDateHeader: 1,
        occurrenceHeaders: ['occurrenceHeader'],
        occurrenceIdHeader: 1,
        associatedTaxaHeader: 2,
        lifeStageHeader: 3,
        sexHeader: 4,
        individualCountHeader: 5,
        organismQuantityHeader: 6,
        organismQuantityTypeHeader: 7,
        taxonHeaders: ['taxoHeaders'],
        taxonIdHeader: 10,
        vernacularNameHeader: 1
      };

      const response = occurrenceService.scrapeOccurrences(mockRows, mockHeaders);

      const mockResponse = [
        {
          associatedTaxa: '2',
          lifeStage: '3',
          sex: '4',
          individualCount: '5',
          vernacularName: '',
          verbatimCoordinates: '',
          organismQuantity: '6',
          organismQuantityType: '7',
          eventDate: ''
        }
      ];

      expect(response).to.eql(mockResponse);
    });

    it('returns an array all data', () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const mockRows = {
        eventRows: [['0', '1', '2', '3', '4', '5', '6', '7']],
        occurrenceRows: [['0', '1', '2', '3', '4', '5', '6', '7']],
        taxonRows: [['0', '1', '2', '3', '4', '5', '6', '7']]
      };

      const mockHeaders = {
        eventHeaders: ['eventHeader'],
        eventIdHeader: 1,
        eventVerbatimCoordinatesHeader: 2,
        eventDateHeader: 1,
        occurrenceHeaders: ['occurrenceHeader'],
        occurrenceIdHeader: 1,
        associatedTaxaHeader: 2,
        lifeStageHeader: 3,
        sexHeader: 4,
        individualCountHeader: 5,
        organismQuantityHeader: 6,
        organismQuantityTypeHeader: 7,
        taxonHeaders: ['taxoHeaders'],
        taxonIdHeader: 1,
        vernacularNameHeader: 1
      };

      const response = occurrenceService.scrapeOccurrences(mockRows, mockHeaders);

      const mockResponse = [
        {
          associatedTaxa: '2',
          lifeStage: '3',
          sex: '4',
          individualCount: '5',
          vernacularName: '1',
          verbatimCoordinates: '2',
          organismQuantity: '6',
          organismQuantityType: '7',
          eventDate: '1'
        }
      ];

      expect(response).to.eql(mockResponse);
    });
  });
});
