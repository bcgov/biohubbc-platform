import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { IDBConnection } from '../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../errors/http-error';
import { TicketSystemUser } from '../models/ticket-system-user';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketSystemUserRepository } from '../repositories/ticket-system-user-repository';
import { TicketSystemUserService } from './ticket-system-user-service';
import { UserService } from './user-service';

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

  it('createTicketAssignee creates assignment for system admin', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(UserService.prototype, 'getUserById').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserByTicketAndSystemUser').resolves(null);
    const insertStub = sinon.stub(TicketSystemUserRepository.prototype, 'insertTicketSystemUser').resolves(assignment);

    const result = await service.createTicketAssignee(
      ticketId,
      { system_user_id: assignment.system_user_id, status: 'requested' },
      { systemUserId: 1, isSystemAdmin: true }
    );

    expect(insertStub).to.have.been.calledOnce;
    expect(result).to.eql(assignment);
  });

  it('createTicketAssignee rejects non-system-admin', async () => {
    try {
      await service.createTicketAssignee(
        ticketId,
        { system_user_id: assignment.system_user_id, status: 'requested' },
        { systemUserId: 1, isSystemAdmin: false }
      );
      expect.fail('Expected create to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP403);
    }
  });

  it('createTicketAssignee rejects duplicate active assignment', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(UserService.prototype, 'getUserById').resolves({} as never);
    sinon
      .stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserByTicketAndSystemUser')
      .resolves(assignment);

    try {
      await service.createTicketAssignee(
        ticketId,
        { system_user_id: assignment.system_user_id, status: 'requested' },
        { systemUserId: 1, isSystemAdmin: true }
      );
      expect.fail('Expected create to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }
  });

  it('updateTicketAssigneeStatus allows owner to patch', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserById').resolves(assignment);
    const updateStub = sinon
      .stub(TicketSystemUserRepository.prototype, 'updateTicketSystemUserStatus')
      .resolves({ ...assignment, status: 'started' });

    const result = await service.updateTicketAssigneeStatus(
      ticketId,
      ticketSystemUserId,
      { status: 'started' },
      { systemUserId: 7, isSystemAdmin: false }
    );

    expect(updateStub).to.have.been.calledWith(ticketId, ticketSystemUserId, { status: 'started' });
    expect(result.status).to.equal('started');
  });

  it('updateTicketAssigneeStatus allows system admin to patch', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserById').resolves(assignment);
    const updateStub = sinon
      .stub(TicketSystemUserRepository.prototype, 'updateTicketSystemUserStatus')
      .resolves({ ...assignment, status: 'blocked' });

    const result = await service.updateTicketAssigneeStatus(
      ticketId,
      ticketSystemUserId,
      { status: 'blocked' },
      { systemUserId: 99, isSystemAdmin: true }
    );

    expect(updateStub).to.have.been.calledWith(ticketId, ticketSystemUserId, { status: 'blocked' });
    expect(result.status).to.equal('blocked');
  });

  it('updateTicketAssigneeStatus rejects non-owner non-admin', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserById').resolves(assignment);

    try {
      await service.updateTicketAssigneeStatus(
        ticketId,
        ticketSystemUserId,
        { status: 'started' },
        { systemUserId: 99, isSystemAdmin: false }
      );
      expect.fail('Expected patch to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP403);
    }
  });

  it('updateTicketAssigneeStatus returns 404 when row not found', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserById').resolves(null);

    try {
      await service.updateTicketAssigneeStatus(
        ticketId,
        ticketSystemUserId,
        { status: 'started' },
        { systemUserId: 99, isSystemAdmin: true }
      );
      expect.fail('Expected patch to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP404);
    }
  });

  it('deleteTicketAssignee soft deletes assignment for system admin', async () => {
    sinon.stub(TicketRepository.prototype, 'getTicketByIdOrNull').resolves({} as never);
    sinon.stub(TicketSystemUserRepository.prototype, 'getActiveTicketSystemUserById').resolves(assignment);
    const deleteStub = sinon.stub(TicketSystemUserRepository.prototype, 'softDeleteTicketSystemUser').resolves();

    await service.deleteTicketAssignee(ticketId, ticketSystemUserId, { systemUserId: 1, isSystemAdmin: true });

    expect(deleteStub).to.have.been.calledWith(ticketId, ticketSystemUserId);
  });
});
