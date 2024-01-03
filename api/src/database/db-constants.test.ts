import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon, { SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import { SystemUser } from '../repositories/user-repository';
import { getMockDBConnection } from '../__mocks__/db';
import * as db from './db';
import { getDBConstants, initDBConstants } from './db-constants';

chai.use(sinonChai);

describe('db-constants', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('when db constants has not been initialized', () => {
    describe('initDBConstants', () => {
      it('catches and re-throws an error', async () => {
        const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').throws(new Error('test error'));

        try {
          await initDBConstants();

          expect.fail();
        } catch (actualError) {
          expect((actualError as Error).message).to.equal('test error');
          expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
        }
      });
    });

    describe('getDBConstants', () => {
      it('throws an error if DBConstants has not been initialized', () => {
        try {
          getDBConstants();

          expect.fail();
        } catch (actualError) {
          expect((actualError as Error).message).to.equal('DBConstants is not initialized');
        }
      });
    });
  });

  describe('when db constants has been initialized', () => {
    let dbConnectionObj: db.IDBConnection;
    let getAPIUserDBConnectionStub: SinonStub<[], db.IDBConnection>;

    before(async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            system_user_id: 1,
            user_identity_source_id: 2,
            user_identifier: 'sims-svc-4464',
            user_guid: 'service-account-sims-svc-4464',
            record_effective_date: '',
            record_end_date: '',
            create_date: '2023-12-12',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 0
          } as SystemUser
        ]
      } as any as Promise<QueryResult<any>>;

      dbConnectionObj = getMockDBConnection({
        open: sinon.stub(),
        commit: sinon.stub(),
        release: sinon.stub(),
        sql: sinon.stub().resolves(mockQueryResponse)
      });

      getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      await initDBConstants();
    });

    describe('initDBConstants', () => {
      it('does nothing if db constants has already been initialized', async () => {
        expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;

        // Call init a second time
        await initDBConstants();

        // Expect not to have been called again (twice)
        expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      });
    });

    describe('getDBConstants', () => {
      it('returns a defined db constants instance if it has been initialized', async () => {
        const dbConstants = getDBConstants();

        expect(dbConstants).not.to.be.undefined;
      });
    });
  });
});
