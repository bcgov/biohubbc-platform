import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import * as db from '../database/db';
import { withConnection } from './with-connection';

chai.use(sinonChai);

describe('withConnection', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('commits and releases when the callback resolves', async () => {
    const connection = stubConnection();

    const result = await withConnection(async () => 'done');

    expect(result).to.equal('done');
    expect(connection.open).to.have.been.calledOnce;
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.rollback).not.to.have.been.called;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rolls back everything written on the connection and rethrows when a later step fails', async () => {
    const connection = stubConnection();
    const failure = new Error('later step failed');
    const writes: string[] = [];

    try {
      await withConnection(async (conn) => {
        expect(conn).to.equal(connection);
        writes.push('status updated');
        throw failure;
      });
      expect.fail('Expected the callback error to propagate');
    } catch (error) {
      expect(error).to.equal(failure);
    }

    expect(writes).to.eql(['status updated']);
    expect(connection.commit).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});

const stubConnection = () => {
  const connection = getMockDBConnection({
    open: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub()
  });
  sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
  return connection;
};
