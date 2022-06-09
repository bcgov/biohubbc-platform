import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../database/db';
import { getMockDBConnection } from '../__mocks__/db';
import * as administrative_activities from './administrative-activities';

chai.use(sinonChai);

describe('getAdministrativeActivities', () => {
  afterEach(() => {
    sinon.restore();
  });

  const dbConnectionObj = getMockDBConnection();

  const sampleReq = {
    keycloak_token: {},
    sql: {
      type: 'type',
      status: ['status']
    }
  } as any;

  let actualResult: any = null;

  const sampleRes = {
    status: () => {
      return {
        json: (result: any) => {
          actualResult = result;
        }
      };
    }
  };

  it('should return the rows on success (empty)', async () => {
    const mockQuery = sinon.stub();

    mockQuery.resolves({
      rows: null,
      rowCount: 0
    });

    sinon.stub(db, 'getDBConnection').returns({ ...dbConnectionObj, sql: mockQuery });

    const result = administrative_activities.getAdministrativeActivities();

    await result(sampleReq, sampleRes as any, null as unknown as any);

    expect(actualResult).to.eql([]);
  });

  it('should return the rows on success (not empty)', async () => {
    const data = {
      id: 1,
      type: 'type',
      type_name: 'type name',
      status: 'status',
      status_name: 'status name',
      description: 'description',
      data: null,
      notes: 'notes',
      create_date: '2020/04/04'
    };

    const mockQuery = sinon.stub();

    mockQuery.resolves({
      rows: [data],
      rowCount: 1
    });

    sinon.stub(db, 'getDBConnection').returns({ ...dbConnectionObj, sql: mockQuery });

    const result = administrative_activities.getAdministrativeActivities();

    await result(sampleReq, sampleRes as any, null as unknown as any);

    expect(actualResult).to.eql([data]);
  });
});
