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

  //TODO NOT DONE TESTS
  describe('scrapeAndUploadOccurrences', () => {
    it('should return an array occurrence_id on scrape and upload', async () => {
      const mockDBConnection = getMockDBConnection();
      const occurrenceService = new OccurrenceService(mockDBConnection);

      const response = await occurrenceService.scrapeAndUploadOccurrences(1, ({} as unknown) as DWCArchive);

      expect(response).to.be.eql([{ occurrence_id: 1 }, { occurrence_id: 2 }]);
    });
  });
});
