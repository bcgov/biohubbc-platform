import { expect } from 'chai';
import { describe } from 'mocha';
import * as pg from 'pg';
import Sinon, { SinonStub } from 'sinon';
import SQL from 'sql-template-strings';
import { getMockDBConnection } from '../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTPError } from '../errors/http-error';
import { SystemUser } from '../models/system-user';
import * as db from './db';
import {
  DB_CLIENT,
  getAPIUserDBConnection,
  getDBConnection,
  getDBPool,
  getKnex,
  getKnexQueryBuilder,
  getServiceAccountDBConnection,
  IDBConnection,
  initDBPool
} from './db';

describe('db', () => {
  describe('getDBPool', () => {
    it('returns an undefined database pool instance if it has not yet been initialized', () => {
      const pool = getDBPool();

      expect(pool).to.be.undefined;
    });

    it('returns a defined database pool instance if it has been initialized', () => {
      initDBPool();

      const pool = getDBPool();

      expect(pool).not.to.be.undefined;
    });
  });

  describe('getDBConnection', () => {
    it('throws an error if keycloak token is undefined', () => {
      try {
        getDBConnection(null as unknown as object);

        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('Keycloak token is undefined');
      }
    });

    it('returns a database connection instance', () => {
      const connection = getDBConnection({});

      expect(connection).not.to.be.null;
    });

    describe('DBConnection', () => {
      const sinonSandbox = Sinon.createSandbox();

      const mockKeycloakToken = {
        preferred_username: 'testguid@idir',
        idir_username: 'testuser',
        identity_provider: SYSTEM_IDENTITY_SOURCE.IDIR
      };

      let queryStub: SinonStub;
      let releaseStub: SinonStub;
      let mockClient: { query: SinonStub; release: SinonStub; processID: number };
      let connectStub: SinonStub;
      let mockPool: { connect: SinonStub };
      let connection: IDBConnection;

      beforeEach(() => {
        queryStub = sinonSandbox.stub().resolves();
        releaseStub = sinonSandbox.stub().resolves();
        mockClient = { query: queryStub, release: releaseStub, processID: 123 };
        connectStub = sinonSandbox.stub().resolves(mockClient);
        mockPool = { connect: connectStub };
        connection = getDBConnection(mockKeycloakToken);
      });

      afterEach(() => {
        sinonSandbox.restore();
      });

      describe('open', () => {
        it('does not acquire a client when its signal is already aborted', async () => {
          const controller = new AbortController();
          controller.abort();
          connection = getDBConnection(mockKeycloakToken, { signal: controller.signal });
          const getDBPoolStub = sinonSandbox
            .stub(db.dbDependencies, 'getDBPool')
            .returns(mockPool as unknown as pg.Pool);

          try {
            await connection.open();
            expect.fail('Expected open to reject');
          } catch (error) {
            expect((error as ApiExecuteSQLError).errors).to.deep.include({
              name: 'AbortError',
              message: 'Database work was aborted'
            });
          }

          expect(getDBPoolStub).not.to.have.been.called;
          expect(connectStub).not.to.have.been.called;
        });

        describe('when not previously called', () => {
          it('opens a new connection, sets the user context, and sends a `BEGIN` query', async () => {
            const getDBPoolStub = sinonSandbox
              .stub(db.dbDependencies, 'getDBPool')
              .returns(mockPool as unknown as pg.Pool);

            await connection.open();

            expect(getDBPoolStub).to.have.been.calledOnce;
            expect(connectStub).to.have.been.calledOnce;

            const expectedSystemUserContextSQL = SQL`select api_set_context(${'testguid'}, ${
              SYSTEM_IDENTITY_SOURCE.IDIR
            });`;

            expect(queryStub).to.have.been.calledWith(
              expectedSystemUserContextSQL?.text,
              expectedSystemUserContextSQL?.values
            );

            expect(queryStub).to.have.been.calledWith('BEGIN');
          });
        });

        describe('when previously called', () => {
          it('does nothing', async () => {
            const getDBPoolStub = sinonSandbox
              .stub(db.dbDependencies, 'getDBPool')
              .returns(mockPool as unknown as pg.Pool);

            // call first time
            await connection.open();

            // reset mock call history
            queryStub.resetHistory();
            connectStub.resetHistory();

            // call second time
            await connection.open();

            expect(getDBPoolStub).to.have.been.calledOnce;

            expect(connectStub).not.to.have.been.called;
            expect(queryStub).not.to.have.been.called;
          });
        });

        describe('when the db pool has not been initialized', () => {
          it('throws an error', async () => {
            const getDBPoolStub = sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(undefined);

            let expectedError: ApiExecuteSQLError;
            try {
              await connection.open();

              expect.fail('Expected an error to be thrown');
            } catch (error) {
              expectedError = error as ApiExecuteSQLError;
            }

            expect(expectedError.message).to.equal('Failed to execute SQL');

            expect(expectedError.errors?.length).to.be.greaterThan(0);
            expectedError.errors?.forEach((item) => {
              expect(item).to.be.eql({ name: 'Error', message: 'DBPool is not initialized' });
            });
            expect(getDBPoolStub).to.have.been.calledOnce;

            expect(connectStub).not.to.have.been.called;
            expect(queryStub).not.to.have.been.called;
          });
        });
      });

      describe('release', () => {
        it('waits for cancellation dispatch before returning the client to the pool', async () => {
          const controller = new AbortController();
          connection = getDBConnection(mockKeycloakToken, { signal: controller.signal });
          sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();
          let finishCancellation!: () => void;
          sinonSandbox.stub(pg.Client.prototype, 'query').returns(
            new Promise((resolve) => {
              finishCancellation = () => resolve({} as any);
            }) as any
          );
          sinonSandbox.stub(pg.Client.prototype, 'end').resolves();

          await connection.open();
          controller.abort();
          const releasePromise = connection.release();
          await Promise.resolve();

          expect(releaseStub).not.to.have.been.called;

          finishCancellation();
          await releasePromise;

          expect(releaseStub).to.have.been.calledOnce;
        });

        describe('when a connection is open', () => {
          describe('when not previously called', () => {
            it('releases the open connection', async () => {
              sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

              await connection.open();

              connection.release();

              expect(releaseStub).to.have.been.calledOnce;
            });
          });

          describe('when previously called', () => {
            it('does not attempt to release a connection', async () => {
              sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

              await connection.open();

              // call first time
              connection.release();

              // reset mock call history
              releaseStub.resetHistory();

              // call second time
              connection.release();

              expect(releaseStub).not.to.have.been.called;
            });
          });
        });

        describe('when a connection is not open', () => {
          it('does not attempt to release a connection', async () => {
            connection.release();

            expect(releaseStub).not.to.have.been.called;
          });
        });
      });

      describe('cancel', () => {
        it('cancels the active PostgreSQL backend using a separate client', async () => {
          sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          const cancellationConnectStub = sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();
          const cancellationQueryStub = sinonSandbox.stub(pg.Client.prototype, 'query').resolves({} as any);
          const cancellationEndStub = sinonSandbox.stub(pg.Client.prototype, 'end').resolves();

          await connection.open();
          await connection.cancel();

          expect(cancellationConnectStub).to.have.been.calledOnce;
          expect(cancellationQueryStub).to.have.been.calledOnceWith('SELECT pg_cancel_backend($1)', [123]);
          expect(cancellationEndStub).to.have.been.calledOnce;
        });

        it('does nothing when the connection is not open', async () => {
          const cancellationConnectStub = sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();

          await connection.cancel();

          expect(cancellationConnectStub).not.to.have.been.called;
        });

        it('cancels once when the connection signal is aborted', async () => {
          const controller = new AbortController();
          connection = getDBConnection(mockKeycloakToken, { signal: controller.signal });
          sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          const cancellationConnectStub = sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();
          const cancellationQueryStub = sinonSandbox.stub(pg.Client.prototype, 'query').resolves({} as any);
          sinonSandbox.stub(pg.Client.prototype, 'end').resolves();

          await connection.open();
          controller.abort();
          await Promise.all([connection.cancel(), connection.cancel()]);

          expect(cancellationConnectStub).to.have.been.calledOnce;
          expect(cancellationQueryStub).to.have.been.calledOnceWith('SELECT pg_cancel_backend($1)', [123]);
        });

        it('does not allow another application query after its signal is aborted', async () => {
          const controller = new AbortController();
          connection = getDBConnection(mockKeycloakToken, { signal: controller.signal });
          sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();
          sinonSandbox.stub(pg.Client.prototype, 'query').resolves({} as any);
          sinonSandbox.stub(pg.Client.prototype, 'end').resolves();

          await connection.open();
          queryStub.resetHistory();
          controller.abort();

          try {
            await connection.query('SELECT 1');
            expect.fail('Expected query to reject');
          } catch (error) {
            expect((error as ApiExecuteSQLError).errors).to.deep.include({
              name: 'AbortError',
              message: 'Database work was aborted'
            });
          }

          expect(queryStub).not.to.have.been.called;
          await connection.release();
        });
      });

      describe('commit', () => {
        describe('when a connection is open', () => {
          it('sends a `COMMIT` query', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            await connection.open();

            connection.commit();

            expect(queryStub).to.have.been.calledWith('COMMIT');
          });
        });

        describe('when a connection is not open', () => {
          it('throws an error', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            let expectedError: ApiExecuteSQLError;
            try {
              await connection.commit();

              expect.fail('Expected an error to be thrown');
            } catch (error) {
              expectedError = error as ApiExecuteSQLError;
            }

            expect(expectedError.message).to.equal('Failed to execute SQL');

            expect(expectedError.errors?.length).to.be.greaterThan(0);
            expectedError.errors?.forEach((item) => {
              expect(item).to.be.eql({ name: 'Error', message: 'DBConnection is not open' });
            });
          });
        });
      });

      describe('query', () => {
        describe('when a connection is open', () => {
          it('sends a query statement', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            await connection.open();

            const queryStatement = `query`;

            await connection.query(queryStatement);

            expect(queryStub).to.have.been.calledWith('query');
          });

          it('sends a query with empty values', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            await connection.open();

            const queryStatement = `query`;

            await connection.query(queryStatement);

            expect(queryStub).to.have.been.calledWith('query', []);
          });
        });

        describe('when a connection is not open', () => {
          it('throws an error', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            let expectedError: ApiExecuteSQLError;
            try {
              const queryStatement = `query ${123}`;

              await connection.query(queryStatement);

              expect.fail('Expected an error to be thrown');
            } catch (error) {
              expectedError = error as ApiExecuteSQLError;
            }

            expect(expectedError.message).to.equal('Failed to execute SQL');

            expect(expectedError.errors?.length).to.be.greaterThan(0);
            expectedError.errors?.forEach((item) => {
              expect(item).to.be.eql({ name: 'Error', message: 'DBConnection is not open' });
            });
          });
        });
      });

      describe('rollback', () => {
        it('waits for cancellation dispatch before sending `ROLLBACK`', async () => {
          const controller = new AbortController();
          connection = getDBConnection(mockKeycloakToken, { signal: controller.signal });
          sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);
          sinonSandbox.stub(pg.Client.prototype, 'connect').resolves();
          let finishCancellation!: () => void;
          sinonSandbox.stub(pg.Client.prototype, 'query').returns(
            new Promise((resolve) => {
              finishCancellation = () => resolve({} as any);
            }) as any
          );
          sinonSandbox.stub(pg.Client.prototype, 'end').resolves();

          await connection.open();
          queryStub.resetHistory();
          controller.abort();
          const rollbackPromise = connection.rollback();
          await Promise.resolve();

          expect(queryStub).not.to.have.been.calledWith('ROLLBACK');

          finishCancellation();
          await rollbackPromise;

          expect(queryStub).to.have.been.calledOnceWith('ROLLBACK');
        });

        describe('when a connection is open', () => {
          it('sends a `ROLLBACK` query', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            await connection.open();

            await connection.rollback();

            expect(queryStub).to.have.been.calledWith('ROLLBACK');
          });
        });

        describe('when a connection is not open', () => {
          it('throws an error', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            let expectedError: ApiExecuteSQLError;
            try {
              await connection.rollback();

              expect.fail('Expected an error to be thrown');
            } catch (error) {
              expectedError = error as ApiExecuteSQLError;
            }

            expect(expectedError.message).to.equal('Failed to execute SQL');

            expect(expectedError.errors?.length).to.be.greaterThan(0);
            expectedError.errors?.forEach((item) => {
              expect(item).to.be.eql({ name: 'Error', message: 'DBConnection is not open' });
            });
          });
        });
      });

      describe('sql', () => {
        describe('when a connection is open', () => {
          it('sends a sql statement', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            await connection.open();

            const sqlStatement = SQL`sql query ${123}`;

            await connection.sql(sqlStatement);

            expect(queryStub).to.have.been.calledWith('sql query $1', [123]);
          });
        });

        describe('when a connection is not open', () => {
          it('throws an error', async () => {
            sinonSandbox.stub(db.dbDependencies, 'getDBPool').returns(mockPool as unknown as pg.Pool);

            let expectedError: ApiExecuteSQLError;
            try {
              const sqlStatement = SQL`sql query ${123}`;

              await connection.sql(sqlStatement);

              expect.fail('Expected an error to be thrown');
            } catch (error) {
              expectedError = error as ApiExecuteSQLError;
            }
            expect(expectedError.message).to.equal('Failed to execute SQL');

            expect(expectedError.errors?.length).to.be.greaterThan(0);
            expectedError.errors?.forEach((item) => {
              expect(item).to.be.eql({ name: 'Error', message: 'DBConnection is not open' });
            });
          });
        });
      });
    });
  });

  describe('getAPIUserDBConnection', () => {
    it('calls getDBConnection for the biohub_api user', () => {
      const mockDBConnection = getMockDBConnection();
      const getDBConnectionStub = Sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      getAPIUserDBConnection();

      const DB_USERNAME = process.env.DB_USER_API;

      expect(getDBConnectionStub).to.have.been.calledWith({
        preferred_username: `${DB_USERNAME}@${SYSTEM_IDENTITY_SOURCE.DATABASE}`,
        identity_provider: SYSTEM_IDENTITY_SOURCE.DATABASE
      });

      getDBConnectionStub.restore();
    });
  });

  describe('getServiceAccountDBConnection', () => {
    it('calls getDBConnection for a service account user', () => {
      const mockDBConnection = getMockDBConnection();
      const getDBConnectionStub = Sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const systemUser: SystemUser = {
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
        revision_count: 0,
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      };

      getServiceAccountDBConnection(systemUser);

      expect(getDBConnectionStub).to.have.been.calledWith({
        preferred_username: 'service-account-sims-svc-4464',
        identity_provider: SYSTEM_IDENTITY_SOURCE.SYSTEM
      });

      getDBConnectionStub.restore();
    });
  });

  describe('getKnexQueryBuilder', () => {
    it('returns a Knex query builder', () => {
      const queryBuilder = getKnexQueryBuilder();

      expect(queryBuilder.client.config).to.eql({ client: DB_CLIENT });
    });
  });

  describe('getKnex', () => {
    it('returns a Knex instance', () => {
      const knex = getKnex();

      expect(knex.client.config).to.eql({ client: DB_CLIENT });
    });
  });
});
