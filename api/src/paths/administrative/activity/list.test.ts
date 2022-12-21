import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { AdministrativeService } from '../../../services/administrative-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as list from './list';

chai.use(sinonChai);

describe('getAdministrativeActivities', () => {
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

    const mockGetAdministrativeActivities = sinon
      .stub(AdministrativeService.prototype, 'getAdministrativeActivities')
      .resolves([]);

    const requestHandler = list.getAdministrativeActivities();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetAdministrativeActivities).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
  });

  it('should return the rows on success (not empty)', async () => {
    const data = {
      id: 1,
      type: 2,
      type_name: 'type name',
      status: 3,
      status_name: 'status name',
      description: 'description',
      data: 'data',
      notes: 'notes',
      create_date: '2020/04/04'
    };

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { type: 'string' };

    const mockGetAdministrativeActivities = sinon
      .stub(AdministrativeService.prototype, 'getAdministrativeActivities')
      .resolves([data]);

    const requestHandler = list.getAdministrativeActivities();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetAdministrativeActivities).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([data]);
  });
});
