import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../database/db';
import { SearchFeatureResult, SearchSubmissionResult, SearchTaxonResult } from '../models/search';
import { SearchRepository } from '../repositories/search-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchService } from './search-service';
import { PaginatedResult } from './search-service.interface';

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

  describe('search', () => {
    it('should return paginated features, submissions, and taxonomy', async () => {
      const features: PaginatedResult<SearchFeatureResult> = {
        data: [{ submission_feature_id: 1, feature_type_id: 1, label: 'Feature1' }],
        total: 1
      };

      const submissions: PaginatedResult<SearchSubmissionResult> = {
        data: [{ submission_id: 10, name: 'Sub1', description: 'Desc1' }],
        total: 1
      };

      const taxonomy: PaginatedResult<SearchTaxonResult> = {
        data: [{ taxon_id: 100, itis_scientific_name: 'TaxonA' }],
        total: 1
      };

      sinon.stub(SearchRepository.prototype, 'findFeatures').resolves(features);
      sinon.stub(SearchRepository.prototype, 'findSubmissions').resolves(submissions);
      sinon.stub(SearchRepository.prototype, 'findTaxon').resolves(taxonomy);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result = await searchService.search({ search: 'test' }, pagination);

      expect(result.features).to.eql(features);
      expect(result.submissions).to.eql(submissions);
      expect(result.taxonomy).to.eql(taxonomy);
    });

    it('should return empty paginated results when repository returns empty', async () => {
      const emptyPaginated = { data: [], total: 0 };

      sinon.stub(SearchRepository.prototype, 'findFeatures').resolves(emptyPaginated);
      sinon.stub(SearchRepository.prototype, 'findSubmissions').resolves(emptyPaginated);
      sinon.stub(SearchRepository.prototype, 'findTaxon').resolves(emptyPaginated);

      const result = await searchService.search({ search: 'none' });

      expect(result.features).to.eql(emptyPaginated);
      expect(result.submissions).to.eql(emptyPaginated);
      expect(result.taxonomy).to.eql(emptyPaginated);
    });
  });
});
