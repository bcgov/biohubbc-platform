import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IGetOccurrenceData, IPostOccurrenceData, OccurrenceRepository } from '../repositories/occurrence-repository';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { getMockDBConnection } from '../__mocks__/db';
import { OccurrenceService } from './occurrence-service';

chai.use(sinonChai);

describe('OccurrenceService', () => {
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
});
