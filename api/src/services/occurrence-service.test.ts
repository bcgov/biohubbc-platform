import chai, { expect } from 'chai';
import { Feature } from 'geojson';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import xlsx from 'xlsx';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { CSVWorksheet } from '../utils/media/csv/csv-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, MediaFile } from '../utils/media/media-file';
import { getMockDBConnection } from '../__mocks__/db';
import {
  DwCAOccurrenceHeaders,
  DwCAOccurrenceRows,
  IGetMapOccurrenceData,
  IGetOrganismData,
  OccurrenceService
} from './occurrence-service';

chai.use(sinonChai);

describe('OccurrenceService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getMapOccurrences', () => {
    it('should return curated Occurrence Submission on get', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const repo = sinon
        .stub(OccurrenceRepository.prototype, 'getMapOccurrences')
        .resolves([{ occurrence_id: 1 } as unknown as IGetOccurrenceData]);

      const formatOccurrenceDataForMapStub = sinon
        .stub(OccurrenceService.prototype, 'formatOccurrenceDataForMap')
        .returns([{ id: 1 } as unknown as IGetMapOccurrenceData]);

      const response = await occurrenceService.getMapOccurrences();

      expect(repo).to.be.calledOnceWith(undefined);
      expect(formatOccurrenceDataForMapStub).to.be.calledOnce;
      expect(response).to.be.eql([{ id: 1 }]);
    });

    describe('formatOccurrenceDataForMap', () => {
      it('should append single object and return', async () => {
        const mockDBConnection = getMockDBConnection();
        const occurrenceService = new OccurrenceService(mockDBConnection);

        const mockInput = [
          {
            occurrence_id: 1,
            submission_id: 2,
            occurrenceid: 'string',
            taxonid: 'string',
            lifestage: 'string',
            sex: 'string',
            eventdate: 'string',
            vernacularname: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string',
            geometry: {}
          } as IGetOccurrenceData
        ];

        const mockResponse = {
          id: 1,
          taxonid: 'string',
          geometry: {} as Feature,
          observations: [
            {
              eventdate: 'string',
              data: [
                {
                  lifestage: 'string',
                  vernacularname: 'string',
                  sex: 'string',
                  individualcount: 1,
                  organismquantity: 1,
                  organismquantitytype: 'string'
                }
              ]
            }
          ]
        } as IGetMapOccurrenceData;

        const formatObservationByDateStub = sinon
          .stub(OccurrenceService.prototype, 'formatObservationByDate')
          .resolves([mockResponse]);

        const response = await occurrenceService.formatOccurrenceDataForMap(mockInput);

        expect(formatObservationByDateStub).to.not.be.called;
        expect(response).to.be.eql([mockResponse]);
      });

      it('should update object increment count and return', async () => {
        const mockDBConnection = getMockDBConnection();
        const occurrenceService = new OccurrenceService(mockDBConnection);

        const mockInput = [
          {
            occurrence_id: 1,
            submission_id: 2,
            occurrenceid: 'string',
            taxonid: 'string',
            lifestage: 'string',
            sex: 'string',
            eventdate: 'string',
            vernacularname: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string',
            geometry: '{}'
          } as unknown as IGetOccurrenceData,
          {
            occurrence_id: 1,
            submission_id: 2,
            occurrenceid: 'string',
            taxonid: 'string',
            lifestage: 'string',
            sex: 'string',
            eventdate: 'string',
            vernacularname: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string',
            geometry: '{}'
          } as unknown as IGetOccurrenceData
        ];

        const expectedReturn = {
          id: 1,
          taxonid: 'string',
          geometry: '{}',
          observations: [
            {
              eventdate: 'string',
              data: [
                {
                  lifestage: 'string',
                  vernacularname: 'string',
                  sex: 'string',
                  individualcount: 2,
                  organismquantity: 1,
                  organismquantitytype: 'string'
                }
              ]
            }
          ]
        } as unknown as IGetMapOccurrenceData;

        const response = await occurrenceService.formatOccurrenceDataForMap(mockInput);

        expect(response).to.be.eql([expectedReturn]);
      });
    });

    describe('formatObservationByDate', () => {
      it('should append single object and return', async () => {
        const mockDBConnection = getMockDBConnection();
        const occurrenceService = new OccurrenceService(mockDBConnection);

        const mockOccurrenceInput = {
          occurrence_id: 1,
          submission_id: 2,
          occurrenceid: 'string',
          taxonid: 'string',
          lifestage: 'string',
          sex: 'string',
          eventdate: 'string2',
          vernacularname: 'string',
          individualcount: 1,
          organismquantity: 1,
          organismquantitytype: 'string',
          geometry: {}
        } as IGetOccurrenceData;

        const mockInput = [
          {
            eventdate: 'string',
            data: [
              {
                lifestage: 'string',
                vernacularname: 'string',
                sex: 'string',
                individualcount: 1,
                organismquantity: 1,
                organismquantitytype: 'string'
              } as IGetOrganismData
            ]
          }
        ] as IGetMapOccurrenceData['observations'];

        const mockResponse = [
          {
            eventdate: 'string',
            data: [
              {
                lifestage: 'string',
                vernacularname: 'string',
                sex: 'string',
                individualcount: 1,
                organismquantity: 1,
                organismquantitytype: 'string'
              }
            ]
          },
          {
            eventdate: 'string2',
            data: [
              {
                lifestage: 'string',
                vernacularname: 'string',
                sex: 'string',
                individualcount: 1,
                organismquantity: 1,
                organismquantitytype: 'string'
              }
            ]
          }
        ] as unknown as IGetMapOccurrenceData;

        const response = await occurrenceService.formatObservationByDate(mockInput, mockOccurrenceInput);

        expect(response).to.be.eql(mockResponse);
      });
    });
    describe('formatObservationByLifestageSex', () => {
      it('should append single object and return', async () => {
        const mockDBConnection = getMockDBConnection();
        const occurrenceService = new OccurrenceService(mockDBConnection);

        const mockOccurrenceInput = {
          occurrence_id: 1,
          submission_id: 2,
          occurrenceid: 'string',
          taxonid: 'string',
          lifestage: 'string2',
          sex: 'string',
          eventdate: 'string',
          vernacularname: 'string',
          individualcount: 1,
          organismquantity: 1,
          organismquantitytype: 'string',
          geometry: {}
        } as IGetOccurrenceData;

        const mockInput = [
          {
            lifestage: 'string',
            vernacularname: 'string',
            sex: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string'
          } as IGetOrganismData
        ];
        const mockResponse = [
          {
            lifestage: 'string',
            vernacularname: 'string',
            sex: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string'
          },

          {
            lifestage: 'string2',
            vernacularname: 'string',
            sex: 'string',
            individualcount: 1,
            organismquantity: 1,
            organismquantitytype: 'string'
          }
        ];

        const response = await occurrenceService.formatObservationByLifestageSex(mockInput, mockOccurrenceInput);

        expect(response).to.be.eql(mockResponse);
      });
    });
  });

  describe('getOccurrenceSubmission', () => {
    it('should return Occurrence Submission on get', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const repo = sinon
        .stub(OccurrenceRepository.prototype, 'getOccurrenceSubmission')
        .resolves({ occurrenceId: 1 } as unknown as IGetOccurrenceData);

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

      const response = await occurrenceService.insertScrapedOccurrence(1, {} as unknown as IPostOccurrenceData);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ occurrence_id: 1 });
    });
  });

  describe('scrapeAndUploadOccurrences', () => {
    it('returns an empty array ', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const getHeadersAndRowsFromFileStub = sinon
        .stub(OccurrenceService.prototype, 'getHeadersAndRowsFromFile')
        .returns({ rows: {} as any, headers: {} as any });

      const scrapeOccurrencesStub = sinon.stub(OccurrenceService.prototype, 'scrapeOccurrences').returns([]);

      const insertOccurrenceStub = sinon.stub(OccurrenceService.prototype, 'insertScrapedOccurrence').resolves();

      const response = await occurrenceService.scrapeAndUploadOccurrences(1, {} as unknown as DWCArchive);

      expect(getHeadersAndRowsFromFileStub).to.have.been.calledOnce;
      expect(scrapeOccurrencesStub).to.have.been.calledOnce;
      expect(insertOccurrenceStub).to.have.not.been.called;
      expect(response).to.be.eql([]);
    });

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

      const response = await occurrenceService.scrapeAndUploadOccurrences(1, {} as unknown as DWCArchive);

      expect(getHeadersAndRowsFromFileStub).to.have.been.calledOnce;
      expect(scrapeOccurrencesStub).to.have.been.calledOnce;

      expect(response).to.be.eql([{ occurrence_id: 1 }, { occurrence_id: 2 }, { occurrence_id: 3 }]);
    });
  });

  describe('scrapeOccurrences', () => {
    it('returns an empty array when no data provided', () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const response = occurrenceService.scrapeOccurrences(
        { occurrenceRows: [] } as unknown as DwCAOccurrenceRows,
        {} as unknown as DwCAOccurrenceHeaders
      );

      expect(response).to.eql([]);
    });

    it('returns an partial array when no event or taxo data provided', () => {
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

    it('returns an array with all data', () => {
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
