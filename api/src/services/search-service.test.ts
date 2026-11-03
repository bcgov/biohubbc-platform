import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { IDBConnection } from '../database/db';
import { SearchTaxonResult } from '../models/search';
import { SearchRepository } from '../repositories/search-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { SearchService } from './search-service';
import { WithCount } from './search-service.interface';

chai.use(sinonChai);

describe('SearchService', () => {
  let mockConnection: IDBConnection;
  let searchService: SearchService;

  beforeEach(() => {
    mockConnection = getMockDBConnection();
    searchService = new SearchService(mockConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findTaxon', () => {
    it('should return local taxon results', async () => {
      const taxonomy: WithCount<SearchTaxonResult> = {
        data: [
          {
            taxon_id: 100,
            itis_tsn: 180702,
            itis_scientific_name: 'Ovis dalli',
            common_name: "Dall's sheep",
            rank: 'Species',
            relevancy_score: 2
          }
        ],
        total: 1
      };

      const findTaxonStub = sinon.stub(SearchRepository.prototype, 'findTaxon').resolves(taxonomy);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result = await searchService.findTaxon({ keyword: 'Ovis dalli' }, pagination);

      expect(findTaxonStub).to.have.been.calledOnceWith({ keyword: 'Ovis dalli' }, pagination);
      expect(result).to.eql(taxonomy);
    });
  });

  describe('getSearchSummary', () => {
    it('should return summary counts for features, submissions, and taxonomy', async () => {
      const featureSummary = [{ feature_type_name: 'survey', total: 5 }];
      const submissionSummary = { total: 3 };
      const taxonomySummary = { total: 5 };

      sinon.stub(SearchRepository.prototype, 'findFeatureSummary').resolves(featureSummary);
      sinon.stub(SearchRepository.prototype, 'findSubmissionSummary').resolves(submissionSummary);
      sinon.stub(SearchRepository.prototype, 'findTaxonSummary').resolves(taxonomySummary);

      const result = await searchService.getSearchSummary({ keyword: 'summary' }, 42);

      expect(result.features).to.eql(featureSummary);
      expect(SearchRepository.prototype.findFeatureSummary).to.have.been.calledOnceWith({ keyword: 'summary' }, 42);
      expect(result.submissions).to.eql(submissionSummary);
      expect(result.taxonomy).to.eql(taxonomySummary);
    });

    it('should propagate error if findFeatureSummary throws', async () => {
      const error = new Error('Feature summary failed');
      sinon.stub(SearchRepository.prototype, 'findFeatureSummary').rejects(error);
      sinon.stub(SearchRepository.prototype, 'findSubmissionSummary').resolves({});
      sinon.stub(SearchRepository.prototype, 'findTaxonSummary').resolves({});

      try {
        await searchService.getSearchSummary({ keyword: 'fail' }, null);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should propagate error if findSubmissionSummary throws', async () => {
      const error = new Error('Submission summary failed');
      sinon.stub(SearchRepository.prototype, 'findFeatureSummary').resolves([]);
      sinon.stub(SearchRepository.prototype, 'findSubmissionSummary').rejects(error);
      sinon.stub(SearchRepository.prototype, 'findTaxonSummary').resolves({});

      try {
        await searchService.getSearchSummary({ keyword: 'fail' }, null);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should propagate error if findTaxonSummary throws', async () => {
      const error = new Error('Taxon summary failed');
      sinon.stub(SearchRepository.prototype, 'findFeatureSummary').resolves([]);
      sinon.stub(SearchRepository.prototype, 'findSubmissionSummary').resolves({});
      sinon.stub(SearchRepository.prototype, 'findTaxonSummary').rejects(error);

      try {
        await searchService.getSearchSummary({ keyword: 'fail' }, null);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });
});
