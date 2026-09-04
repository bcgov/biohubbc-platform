import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { SearchService } from '../../../services/search-service';
import * as search from './index';

chai.use(sinonChai);

describe('searchTaxon', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return paginated local taxon search results', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      filters: { keyword: 'Ovis dalli' },
      pagination: { page: '1', limit: '10' }
    };

    const taxonomy = [
      {
        taxon_id: 12,
        itis_tsn: 180702,
        itis_scientific_name: 'Ovis dalli',
        common_name: "Dall's sheep",
        rank: 'Species',
        relevancy_score: 1
      }
    ];
    const findTaxonStub = sinon.stub(SearchService.prototype, 'findTaxon').resolves({ data: taxonomy, total: 1 });

    const requestHandler = search.searchTaxon();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(findTaxonStub).to.have.been.calledOnceWith(
      { keyword: 'Ovis dalli' },
      { page: 1, limit: 10, sort: undefined, order: undefined }
    );
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      taxonomy,
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('should rollback and release on errors', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub().resolves(),
      open: sinon.stub().resolves()
    });
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { filters: { keyword: 'Ovis' } };

    const testError = new Error('Test error');
    sinon.stub(SearchService.prototype, 'findTaxon').rejects(testError);

    const requestHandler = search.searchTaxon();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.equal(testError);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
