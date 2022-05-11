import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import xlsx from 'xlsx';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { CSVWorksheet } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, MediaFile } from '../utils/media/media-file';
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

  describe('getHeadersAndRowsFromFile', () => {
    it('returns empty rows and headers when DWCArchive CSVWorksheets have no data', async () => {
      const mediaFile = new MediaFile('fileName', 'txt', Buffer.from([]));
      const archiveFile = new ArchiveFile('zipName', 'zip', Buffer.from([]), [mediaFile]);

      const dwcArchive = new DWCArchive(archiveFile);

      dwcArchive.worksheets = {
        event: new CSVWorksheet('event'),
        occurrence: new CSVWorksheet('occurrence'),
        taxon: new CSVWorksheet('taxon')
      };

      const mockDBConnection = getMockDBConnection();

      const occurrenceService = new OccurrenceService(mockDBConnection);

      const { rows, headers } = occurrenceService.getHeadersAndRowsFromFile(dwcArchive);

      const expectedRows: DwCAOccurrenceRows = {
        eventRows: [],
        occurrenceRows: [],
        taxonRows: []
      };

      const expectedHeaders: DwCAOccurrenceHeaders = {
        eventHeaders: [],
        eventIdHeader: -1,
        eventVerbatimCoordinatesHeader: -1,
        eventDateHeader: -1,
        occurrenceHeaders: [],
        occurrenceIdHeader: -1,
        associatedTaxaHeader: -1,
        lifeStageHeader: -1,
        sexHeader: -1,
        individualCountHeader: -1,
        organismQuantityHeader: -1,
        organismQuantityTypeHeader: -1,
        taxonHeaders: [],
        taxonIdHeader: -1,
        vernacularNameHeader: -1
      };

      expect(rows).to.eql(expectedRows);
      expect(headers).to.eql(expectedHeaders);
    });

    it('returns rows and headers when DWCArchive CSVWorksheets have valid expected data', async () => {
      const mediaFile = new MediaFile('fileName', 'txt', Buffer.from([]));
      const archiveFile = new ArchiveFile('zipName', 'zip', Buffer.from([]), [mediaFile]);

      const dwcArchive = new DWCArchive(archiveFile);

      dwcArchive.worksheets = {
        event: new CSVWorksheet(
          'event',
          xlsx.utils.aoa_to_sheet([
            ['id', 'eventDate', 'verbatimCoordinates'],
            ['1', '2022-05-11', '9N 573674 6114170'],
            ['2', '2022-06-12', '8N 573674 6114170']
          ])
        ),
        occurrence: new CSVWorksheet(
          'occurrence',
          xlsx.utils.aoa_to_sheet([
            ['id', 'associatedTaxa', 'lifeStage', 'sex', 'individualCount', 'organismQuantity', 'organismQuantityType'],
            ['1', 'Alces Americanus', 'Adult', 'Male', '2', '', ''],
            ['2', 'Alces Americanus', 'Adult', 'Female', '3', '4', '5']
          ])
        ),
        taxon: new CSVWorksheet(
          'taxon',
          xlsx.utils.aoa_to_sheet([
            ['id', 'vernacularName'],
            ['1', 'Moose'],
            ['2', 'Moose']
          ])
        )
      };

      const mockDBConnection = getMockDBConnection();

      const occurrenceService = new OccurrenceService(mockDBConnection);

      const { rows, headers } = occurrenceService.getHeadersAndRowsFromFile(dwcArchive);

      const expectedRows: DwCAOccurrenceRows = {
        eventRows: [
          ['1', '2022-05-11', '9N 573674 6114170'],
          ['2', '2022-06-12', '8N 573674 6114170']
        ],
        occurrenceRows: [
          ['1', 'Alces Americanus', 'Adult', 'Male', '2', '', ''],
          ['2', 'Alces Americanus', 'Adult', 'Female', '3', '4', '5']
        ],
        taxonRows: [
          ['1', 'Moose'],
          ['2', 'Moose']
        ]
      };

      const expectedHeaders: DwCAOccurrenceHeaders = {
        eventHeaders: ['id', 'eventDate', 'verbatimCoordinates'],
        eventIdHeader: 0,
        eventVerbatimCoordinatesHeader: 2,
        eventDateHeader: 1,
        occurrenceHeaders: [
          'id',
          'associatedTaxa',
          'lifeStage',
          'sex',
          'individualCount',
          'organismQuantity',
          'organismQuantityType'
        ],
        occurrenceIdHeader: 0,
        associatedTaxaHeader: 1,
        lifeStageHeader: 2,
        sexHeader: 3,
        individualCountHeader: 4,
        organismQuantityHeader: 5,
        organismQuantityTypeHeader: 6,
        taxonHeaders: ['id', 'vernacularName'],
        taxonIdHeader: 0,
        vernacularNameHeader: 1
      };

      expect(rows).to.eql(expectedRows);
      expect(headers).to.eql(expectedHeaders);
    });
  });
});
