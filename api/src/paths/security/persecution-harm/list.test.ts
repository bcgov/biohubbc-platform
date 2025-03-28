import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as list from './list';

chai.use(sinonChai);

describe('getPersecutionAndHarmRules', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return the rows on success (empty)', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { type: 'string' };

    const mockGetPersecutionAndHarmRules = sinon
      .stub(SecurityService.prototype, 'getPersecutionAndHarmRules')
      .resolves([]);

    const requestHandler = list.getPersecutionAndHarmRules();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetPersecutionAndHarmRules).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
  });

  it('should return the rows on success (not empty)', async () => {
    const data = {
      persecution_or_harm_id: 1,
      persecution_or_harm_type_id: 2,
      wldtaxonomic_units_id: 3,
      name: 'name',
      description: 'description'
    };

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { type: 'string' };

    const mockGetPersecutionAndHarmRules = sinon
      .stub(SecurityService.prototype, 'getPersecutionAndHarmRules')
      .resolves([data]);

    const requestHandler = list.getPersecutionAndHarmRules();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetPersecutionAndHarmRules).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([data]);
  });
});
