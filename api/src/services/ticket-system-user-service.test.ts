import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP404 } from '../errors/http-error';
import { TicketSystemUser } from '../models/ticket-system-user';
import { TicketSystemUserRepository } from '../repositories/ticket-system-user-repository';
import { TicketSystemUserService } from './ticket-system-user-service';

chai.use(sinonChai);

describe('TicketSystemUserService', () => {
  let mockDBConnection: IDBConnection;
  let service: TicketSystemUserService;

  const ticketId = '11111111-1111-1111-1111-111111111111';
  const ticketSystemUserId = '22222222-2222-2222-2222-222222222222';

  const assignment: TicketSystemUser = {
    ticket_system_user_id: ticketSystemUserId,
    ticket_id: ticketId,
    system_user_id: 7,
    status: 'requested'
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TicketSystemUserService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('createTicketSystemUsers creates assignments for system admin', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'findTicketSystemUsers').resolves([]);
    const insertStub = sinon.stub(TicketSystemUserRepository.prototype, 'insertTicketSystemUser').resolves(assignment);

    const result = await service.createTicketSystemUsers(ticketId, [
      {
        system_user_id: assignment.system_user_id,
        status: 'requested'
      }
    ]);

    expect(insertStub).to.have.been.calledOnce;
    expect(result).to.eql([assignment]);
  });

  it('createTicketSystemUsers inserts every payload item', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'findTicketSystemUsers').resolves([]);
    const insertStub = sinon.stub(TicketSystemUserRepository.prototype, 'insertTicketSystemUser').resolves(assignment);

    await service.createTicketSystemUsers(ticketId, [
      {
        system_user_id: 7,
        status: 'requested'
      },
      {
        system_user_id: 8,
        status: 'started'
      }
    ]);

    expect(insertStub).to.have.been.calledTwice;
    expect(insertStub.firstCall).to.have.been.calledWith(ticketId, { system_user_id: 7, status: 'requested' });
    expect(insertStub.secondCall).to.have.been.calledWith(ticketId, { system_user_id: 8, status: 'started' });
  });

  it('createTicketSystemUsers returns 409 when one or more users are already assigned', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'findTicketSystemUsers').resolves([assignment]);
    const insertStub = sinon.stub(TicketSystemUserRepository.prototype, 'insertTicketSystemUser').resolves(assignment);

    try {
      await service.createTicketSystemUsers(ticketId, [
        {
          system_user_id: 7,
          status: 'requested'
        }
      ]);
      expect.fail('Expected create to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiConflictError);
      expect((error as ApiConflictError).message).to.equal('One or more users are already assigned to this ticket');
    }

    expect(insertStub).to.not.have.been.called;
  });

  it('updateTicketSystemUserStatus updates ticket system user status', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'getTicketSystemUserByTicketAndSystemUserId').resolves(assignment);
    const updateStub = sinon
      .stub(TicketSystemUserRepository.prototype, 'updateTicketSystemUserStatus')
      .resolves({ ...assignment, status: 'started' });

    const result = await service.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status: 'started' });

    expect(updateStub).to.have.been.calledWith(ticketId, ticketSystemUserId, { status: 'started' });
    expect(result.status).to.equal('started');
  });

  it('updateTicketSystemUserStatus returns 404 when row not found', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'getTicketSystemUserByTicketAndSystemUserId').resolves(null);

    try {
      await service.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status: 'started' });
      expect.fail('Expected patch to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP404);
    }
  });

  it('updateTicketSystemUserStatus returns existing row when status is unchanged', async () => {
    sinon.stub(TicketSystemUserRepository.prototype, 'getTicketSystemUserByTicketAndSystemUserId').resolves(assignment);
    const updateStub = sinon
      .stub(TicketSystemUserRepository.prototype, 'updateTicketSystemUserStatus')
      .resolves(assignment);

    const result = await service.updateTicketSystemUserStatus(ticketId, ticketSystemUserId, { status: 'requested' });

    expect(result).to.eql(assignment);
    expect(updateStub).to.not.have.been.called;
  });

  it('deleteTicketSystemUser soft deletes assignment for system admin', async () => {
    const deleteStub = sinon.stub(TicketSystemUserRepository.prototype, 'softDeleteTicketSystemUser').resolves();

    await service.deleteTicketSystemUser(ticketId, ticketSystemUserId);

    expect(deleteStub).to.have.been.calledWith(ticketId, ticketSystemUserId);
  });
});
