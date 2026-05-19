import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTP400 } from '../errors/http-error';
import { CreateDataRequestPayload, DataRequest, UpdateDataRequest } from '../models/data-request';
import { ExpressionTree } from '../models/expression-tree';
import { PolicyEffect } from '../models/policy-statement';
import { TeamMemberWithUser } from '../models/team-member';
import { TeamPolicy } from '../models/team-policy';
import { Ticket } from '../models/ticket';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { FeatureIngestionRepository } from '../repositories/ingestion/feature-ingestion-repository';
import { PolicyService } from './access-policy/policy-service';
import { PolicyWithStatements } from './access-policy/policy-service.interface';
import { PolicyStatementExpressionService } from './access-policy/policy-statement-expression-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { ExpressionTreeService } from './expression-tree-service';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

describe('DataRequestService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    policy_id: 'f5f6a7b8-c9d0-1234-efab-345678901234',
    status: 'requested',
    create_date: '2026-04-17T00:00:00.000Z'
  };

  const mockTeamMember: TeamMemberWithUser = {
    team_member_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    system_user_id: 1,
    user_identifier: 'user_1',
    email: 'user_1@test.com'
  };

  // Minimal valid Ticket used for stubbing TicketService.createTicket return values.
  const buildMockTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
    ticket_id: mockDataRequest.ticket_id,
    ticket_slug: '11000001',
    subject: 'Data Request',
    description: 'reason',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-04-17T00:00:00.000Z',
    priority: 'medium',
    status: 'open',
    ...overrides
  });

  // Minimal valid PolicyWithStatements used for stubbing PolicyService.createPolicyWithStatements.
  const buildMockPolicy = (statementIds: string[] = []): PolicyWithStatements => ({
    policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    name: 'Data request policy - uuid',
    description: null,
    status: 'requested',
    statements: statementIds.map((id, idx) => ({
      policy_statement_id: id,
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      effect: PolicyEffect.ALLOW,
      submission_feature_urn: `urn:*:f${idx}:*`,
      conditions: []
    }))
  });

  // Minimal valid ExpressionTree used to drive the expression-write branch.
  const buildMockExpression = (): ExpressionTree => ({
    type: 'expression',
    operator: 'AND',
    clauses: [
      {
        type: 'predicate',
        feature_property_id: 1,
        feature_type_property_id: null,
        operator: 'Equals',
        value: 'x'
      }
    ]
  });

  it('findDataRequestById returns repository value', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);

    const result = await service.findDataRequestById(mockDataRequest.data_request_id);

    expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
    expect(result).to.deep.equal(mockDataRequest);
  });

  it('findDataRequestsByTeamMembership delegates to repository with system user ids', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);
    const userIds = [1, 2];
    const filters = { status: 'requested' as const };

    const stub = sinon
      .stub(DataRequestRepository.prototype, 'findDataRequestsByTeamMembership')
      .resolves([mockDataRequest]);

    const result = await service.findDataRequestsByTeamMembership(userIds, filters);

    expect(stub).to.have.been.calledOnceWith(userIds, filters);
    expect(result).to.deep.equal([mockDataRequest]);
  });

  it('createDataRequest derives subject from featureTypes + reason and delegates to createDataRequestForTicket', async () => {
    // Verifies: the auto-ticket path composes the ticket subject from BOTH featureTypes and reason,
    // and then hands off the full payload (including featureTypes/expression) to the ticket-bound flow.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: build a payload that exercises the scope-prefixed subject branch.
    const payload: CreateDataRequestPayload = {
      requested_by: mockDataRequest.requested_by,
      reason: 'Need observation data for the Peace River caribou',
      system_user_ids: [2, 3],
      featureTypes: ['observation']
    };

    // Step 2: stub ticket creation and the ticket-bound delegate. We are NOT testing the inner
    // method here — only that the outer method composes the correct subject and forwards the payload.
    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(buildMockTicket());
    const createForTicketStub = sinon
      .stub(DataRequestService.prototype, 'createDataRequestForTicket')
      .resolves(mockDataRequest);

    // Step 3: invoke the method under test.
    const result = await service.createDataRequest(payload);

    // Step 4: assert subject composition includes both scope and excerpt.
    expect(createTicketStub).to.have.been.calledOnceWith({
      subject: 'Data Request: observation — Need observation data for the Peace River caribou',
      description: payload.reason,
      priority: 'medium'
    });

    // Step 5: assert the full payload (including featureTypes) is forwarded to the ticket-bound delegate.
    expect(createForTicketStub).to.have.been.calledOnceWith(mockDataRequest.ticket_id, payload);
    expect(result).to.deep.equal(mockDataRequest);
  });

  it('_generateTicketSubject returns "Data Request" when reason and featureTypes are empty', async () => {
    // Verifies: with no reason and no scope, the subject collapses to the bare "Data Request" label.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: stub createTicket so we can capture the composed subject without running downstream logic.
    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(buildMockTicket());
    sinon.stub(DataRequestService.prototype, 'createDataRequestForTicket').resolves(mockDataRequest);

    // Step 2: drive the private helper via createDataRequest using an empty reason and no featureTypes.
    await service.createDataRequest({
      requested_by: 1,
      reason: '',
      system_user_ids: []
    });

    // Step 3: assert the captured subject matches the bare label.
    expect(createTicketStub.firstCall.args[0].subject).to.equal('Data Request');
  });

  it('_generateTicketSubject returns "Data Request - <excerpt>" when only reason is provided', async () => {
    // Verifies: legacy reason-only format trims the excerpt to the first 10 whitespace-separated words.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: capture the subject via the createTicket spy.
    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(buildMockTicket());
    sinon.stub(DataRequestService.prototype, 'createDataRequestForTicket').resolves(mockDataRequest);

    // Step 2: pass a 12-word reason; the 11th and 12th words must be dropped.
    await service.createDataRequest({
      requested_by: 1,
      reason: 'one two three four five six seven eight nine ten eleven twelve',
      system_user_ids: []
    });

    // Step 3: assert the legacy "Data Request - <first 10 words>" format.
    expect(createTicketStub.firstCall.args[0].subject).to.equal(
      'Data Request - one two three four five six seven eight nine ten'
    );
  });

  it('_generateTicketSubject returns "Data Request: <joined>" when only featureTypes is provided', async () => {
    // Verifies: scope-only payloads produce a subject with the comma-joined feature type list and no excerpt.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: capture the subject via the createTicket spy across two separate invocations.
    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(buildMockTicket());
    sinon.stub(DataRequestService.prototype, 'createDataRequestForTicket').resolves(mockDataRequest);

    // Step 2: single feature type, empty reason.
    await service.createDataRequest({
      requested_by: 1,
      reason: '',
      system_user_ids: [],
      featureTypes: ['observation']
    });

    // Step 3: two feature types, empty reason.
    await service.createDataRequest({
      requested_by: 1,
      reason: '',
      system_user_ids: [],
      featureTypes: ['observation', 'telemetry']
    });

    // Step 4: assert both composed subjects.
    expect(createTicketStub.getCall(0).args[0].subject).to.equal('Data Request: observation');
    expect(createTicketStub.getCall(1).args[0].subject).to.equal('Data Request: observation, telemetry');
  });

  it('_generateTicketSubject leads with feature types and follows with em-dash + excerpt when both present', async () => {
    // Verifies: scope+reason payloads produce "Data Request: <scope> — <excerpt>" with a U+2014 em-dash
    // separator and a 10-word excerpt cap.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: capture the subject.
    const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(buildMockTicket());
    sinon.stub(DataRequestService.prototype, 'createDataRequestForTicket').resolves(mockDataRequest);

    // Step 2: drive with a 12-word reason and a two-element scope.
    await service.createDataRequest({
      requested_by: 1,
      reason: 'Need observation data for the Peace River caribou study to validate trends',
      system_user_ids: [],
      featureTypes: ['observation', 'telemetry']
    });

    // Step 3: assert exact composition. The em-dash between scope and excerpt is U+2014, not a hyphen.
    // The excerpt is the first 10 whitespace-separated words of the reason, stopping at "to".
    expect(createTicketStub.firstCall.args[0].subject).to.equal(
      'Data Request: observation, telemetry — Need observation data for the Peace River caribou study to'
    );
  });

  it('createDataRequestForTicket inserts every system_user_ids entry into both teams without unioning the requester', async () => {
    // Verifies: the service treats `system_user_ids` as the canonical access list and does NOT add the
    // requester back in. Union-with-requester semantics belong to the user-facing route, not the service.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    const createTeamMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy());
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Act with a requester not present in system_user_ids; the service should NOT add 7.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 7,
      reason: 'r',
      system_user_ids: [42, 99]
    });

    // 2 members × 2 teams = 4 inserts. The requester (7) is absent — caller owns that decision.
    expect(createTeamMemberStub).to.have.callCount(4);
    const seen = new Set(createTeamMemberStub.getCalls().map((call) => call.args[0].system_user_id));
    expect(seen).to.deep.equal(new Set([42, 99]));
  });

  it('createDataRequestForTicket dedupes duplicate ids in system_user_ids before inserting team members', async () => {
    // Verifies: defensive dedup inside _createTeamWithMembers collapses duplicates so the database
    // does not see redundant team_member inserts for the same (team_id, system_user_id).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    const createTeamMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy());
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 7,
      reason: 'r',
      system_user_ids: [42, 42, 99]
    });

    // 2 unique members × 2 teams = 4 inserts; values across calls are {42, 99}.
    expect(createTeamMemberStub).to.have.callCount(4);
    const seen = new Set(createTeamMemberStub.getCalls().map((call) => call.args[0].system_user_id));
    expect(seen).to.deep.equal(new Set([42, 99]));
  });

  it('createDataRequestForTicket inserts nothing when system_user_ids is empty', async () => {
    // Verifies: an empty access list produces zero team_member inserts (no implicit requester fallback).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    const createTeamMemberStub = sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy());
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 7,
      reason: 'r',
      system_user_ids: []
    });

    expect(createTeamMemberStub).to.have.callCount(0);
  });

  it('createDataRequestForTicket builds one ALLOW statement per featureType with URN urn:*:<ft>:* and status "requested"', async () => {
    // Verifies: the per-feature-type ALLOW statement projection produces the canonical URN shape
    // and the auto-generated policy starts life in the "requested" status.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: precheck returns both feature types as known.
    sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
      { feature_type_id: 1, name: 'observation' },
      { feature_type_id: 2, name: 'telemetry' }
    ]);
    // Step 2: expression write returns a single tree id; we will verify per-statement linking in S12.
    sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-1' });

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);

    const createPolicyStub = sinon
      .stub(PolicyService.prototype, 'createPolicyWithStatements')
      .resolves(buildMockPolicy(['st-1', 'st-2']));
    sinon.stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression').resolves();
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 3: act with a two-element featureTypes list and a valid expression.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [],
      featureTypes: ['observation', 'telemetry'],
      expression: buildMockExpression()
    });

    // Step 4: createPolicyWithStatements is called once; policy data carries status:'requested'
    // and a non-empty description (the description is human-readable context, not load-bearing).
    expect(createPolicyStub).to.have.been.calledOnce;
    expect(createPolicyStub.firstCall.args[0].status).to.equal('requested');
    expect(createPolicyStub.firstCall.args[0].description).to.be.a('string').and.not.empty;

    // Step 5: statements array deeply equals the per-feature-type ALLOW URNs in order.
    expect(createPolicyStub.firstCall.args[1]).to.deep.equal([
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:observation:*' },
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:telemetry:*' }
    ]);
  });

  it('createDataRequestForTicket writes the expression tree exactly once even with multiple featureTypes', async () => {
    // Verifies: "one tree, many statement links" — even with N statements, writeExpressionTree fires once,
    // keeping expression_tree row counts proportional to requests, not statements.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: precheck returns both feature types as known.
    sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
      { feature_type_id: 1, name: 'observation' },
      { feature_type_id: 2, name: 'telemetry' }
    ]);
    const writeExpressionStub = sinon
      .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
      .resolves({ expression_id: 'expr-1' });
    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy(['st-1', 'st-2']));
    sinon.stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression').resolves();
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 2: act with two feature types and an explicit expression payload.
    const expression = buildMockExpression();
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [],
      featureTypes: ['observation', 'telemetry'],
      expression
    });

    // Step 3: writeExpressionTree fired exactly once with the supplied tree.
    expect(writeExpressionStub).to.have.been.calledOnceWith(expression);
  });

  it('createDataRequestForTicket links the same expression_id to every policy statement', async () => {
    // Verifies: each created statement is linked to the SAME expression_id via the statement-expression service.
    // This is the back half of "one tree, many links".
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: precheck + expression write.
    sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap').resolves([
      { feature_type_id: 1, name: 'observation' },
      { feature_type_id: 2, name: 'telemetry' }
    ]);
    sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-1' });
    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    // Step 2: policy creation returns two statements whose ids drive the link calls.
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy(['st-1', 'st-2']));
    const replaceStub = sinon
      .stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression')
      .resolves();
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 3: act.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [],
      featureTypes: ['observation', 'telemetry'],
      expression: buildMockExpression()
    });

    // Step 4: both statements get linked to the same expression id.
    expect(replaceStub).to.have.callCount(2);
    expect(replaceStub.getCall(0).args).to.deep.equal(['st-1', 'expr-1']);
    expect(replaceStub.getCall(1).args).to.deep.equal(['st-2', 'expr-1']);
  });

  it('createDataRequestForTicket skips expression writes when expression is null', async () => {
    // Verifies: featureTypes + null expression still produces ALLOW statements but does NOT write a tree
    // or link statements to one (no orphan expression rows).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: precheck returns the known type.
    sinon
      .stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap')
      .resolves([{ feature_type_id: 1, name: 'observation' }]);
    const writeExpressionStub = sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree');
    const replaceStub = sinon.stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression');

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    const createPolicyStub = sinon
      .stub(PolicyService.prototype, 'createPolicyWithStatements')
      .resolves(buildMockPolicy(['st-1']));
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 2: act with featureTypes set and expression explicitly null.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [],
      featureTypes: ['observation'],
      expression: null
    });

    // Step 3: no expression-tree writes and no statement-expression links.
    expect(writeExpressionStub).to.not.have.been.called;
    expect(replaceStub).to.not.have.been.called;

    // Step 4: policy is still created with the single ALLOW statement.
    expect(createPolicyStub).to.have.been.calledOnce;
    expect(createPolicyStub.firstCall.args[1]).to.deep.equal([
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:observation:*' }
    ]);
  });

  it('createDataRequestForTicket preserves the deny-all statement and skips precheck when featureTypes is omitted', async () => {
    // Verifies: the admin/ticket-bound flow with no featureTypes preserves the deny-all baseline policy
    // and does NOT consult the feature-type catalog or the expression services.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: spy precheck/expression to verify they are NOT invoked.
    const getActiveStub = sinon.stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap');
    const writeExpressionStub = sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree');
    const replaceStub = sinon.stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression');

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    const createPolicyStub = sinon
      .stub(PolicyService.prototype, 'createPolicyWithStatements')
      .resolves(buildMockPolicy(['st-1']));
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 2: act with no featureTypes.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [2, 3]
    });

    // Step 3: precheck and expression services were never touched.
    expect(getActiveStub).to.not.have.been.called;
    expect(writeExpressionStub).to.not.have.been.called;
    expect(replaceStub).to.not.have.been.called;

    // Step 4: deny-all baseline preserved.
    expect(createPolicyStub).to.have.been.calledOnce;
    expect(createPolicyStub.firstCall.args[1]).to.deep.equal([
      { effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }
    ]);
  });

  it('createDataRequestForTicket throws HTTP400 and skips policy/team-policy/repo writes when an unknown featureType is supplied', async () => {
    // Verifies: typos or stale frontend identifiers fail fast at the precheck instead of producing
    // half-built request artifacts (no policy/team-policy/data-request rows are written).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: catalog knows only 'observation'; 'weatherz' is the unknown.
    sinon
      .stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap')
      .resolves([{ feature_type_id: 1, name: 'observation' }]);
    const writeExpressionStub = sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree');
    const createPolicyStub = sinon.stub(PolicyService.prototype, 'createPolicyWithStatements');
    const createTeamPolicyStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy');
    const createRequestStub = sinon.stub(DataRequestRepository.prototype, 'createDataRequest');

    // Step 2: team creation must still be stubbed since it runs before the precheck.
    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);

    // Step 3: act and capture the rejection.
    let caught: unknown;
    try {
      await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
        requested_by: 1,
        reason: 'r',
        system_user_ids: [],
        featureTypes: ['observation', 'weatherz']
      });
    } catch (err) {
      caught = err;
    }

    // Step 4: error is HTTP400 with the expected message and a `unknownFeatureTypes` error payload.
    expect(caught).to.be.instanceof(HTTP400);
    const error = caught as HTTP400;
    expect(error.message).to.include('Unknown feature type(s)');
    expect(error.errors).to.deep.equal([{ unknownFeatureTypes: ['weatherz'] }]);

    // Step 5: downstream writes were NOT invoked.
    expect(writeExpressionStub).to.not.have.been.called;
    expect(createPolicyStub).to.not.have.been.called;
    expect(createTeamPolicyStub).to.not.have.been.called;
    expect(createRequestStub).to.not.have.been.called;
  });

  it('createDataRequestForTicket creates duplicate statements when featureTypes contains duplicates (no service-level dedupe)', async () => {
    // Verifies: the service does NOT dedupe featureTypes itself — duplicate entries produce duplicate
    // ALLOW statements. This documents current behavior (any deduplication is the caller's responsibility).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: precheck + expression write.
    sinon
      .stub(FeatureIngestionRepository.prototype, 'getActiveFeatureTypeMap')
      .resolves([{ feature_type_id: 1, name: 'observation' }]);
    const writeExpressionStub = sinon
      .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
      .resolves({ expression_id: 'expr-1' });

    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    const createPolicyStub = sinon
      .stub(PolicyService.prototype, 'createPolicyWithStatements')
      .resolves(buildMockPolicy(['st-1', 'st-2']));
    const replaceStub = sinon
      .stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression')
      .resolves();
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 2: act with duplicate featureTypes entries.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: [],
      featureTypes: ['observation', 'observation'],
      expression: buildMockExpression()
    });

    // Step 3: createPolicyWithStatements receives exactly 2 ALLOW statements with the same URN.
    expect(createPolicyStub.firstCall.args[1]).to.deep.equal([
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:observation:*' },
      { effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:observation:*' }
    ]);

    // Step 4: expression write fires once; both statements link to it.
    expect(writeExpressionStub).to.have.callCount(1);
    expect(replaceStub).to.have.callCount(2);
  });

  it('createDataRequestForTicket links team_policy to the policy team (not the data-request team)', async () => {
    // Verifies: team-policy linkage targets the POLICY team (the second createTeam call), not the
    // data-request team. Mixing these up would grant policy administration to the wrong audience.
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: order matters — first createTeam call is the data-request team, second is the policy team.
    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy());
    const createTeamPolicyStub = sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);
    sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequest);
    sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequest);

    // Step 2: act.
    await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: []
    });

    // Step 3: team_policy linkage is against the POLICY team, not the data-request team.
    expect(createTeamPolicyStub).to.have.been.calledOnceWith({
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    });
  });

  it('createDataRequestForTicket persists composite ids and re-fetches via getDataRequestById for derived status', async () => {
    // Verifies: the data-request row is persisted with the composed { requested_by, reason, team_id,
    // ticket_id, policy_id } shape, AND the method returns the re-fetched value (status is joined from
    // the policy, not whatever the insert path returned).
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    // Step 1: order-determined team ids drive the assertion.
    sinon
      .stub(TeamService.prototype, 'createTeam')
      .onFirstCall()
      .resolves({ team_id: 'dr-team', name: 'dr', description: null, member_count: 0 })
      .onSecondCall()
      .resolves({ team_id: 'policy-team', name: 'policy', description: null, member_count: 0 });
    sinon.stub(TeamMemberService.prototype, 'createTeamMember').resolves(mockTeamMember);
    sinon.stub(PolicyService.prototype, 'createPolicyWithStatements').resolves(buildMockPolicy());
    sinon.stub(TeamPolicyService.prototype, 'createTeamPolicy').resolves({
      team_policy_id: 'tp-1',
      team_id: 'policy-team',
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    } as TeamPolicy);

    // Step 2: repository insert returns a stale status ('pending'-shaped placeholder); getDataRequestById
    // resolves the canonical (joined) status. The method MUST return the re-fetched value.
    const createRequestStub = sinon
      .stub(DataRequestRepository.prototype, 'createDataRequest')
      .resolves({ ...mockDataRequest, data_request_id: 'dr-1', status: 'denied' });
    const getDataRequestStub = sinon
      .stub(DataRequestService.prototype, 'getDataRequestById')
      .resolves({ ...mockDataRequest, data_request_id: 'dr-1', status: 'requested' });

    // Step 3: act.
    const result = await service.createDataRequestForTicket(mockDataRequest.ticket_id, {
      requested_by: 1,
      reason: 'r',
      system_user_ids: []
    });

    // Step 4: composite-id payload passed to the repository.
    expect(createRequestStub).to.have.been.calledOnce;
    expect(createRequestStub.firstCall.args[0]).to.deep.equal({
      requested_by: 1,
      reason: 'r',
      team_id: 'dr-team',
      ticket_id: mockDataRequest.ticket_id,
      policy_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345'
    });

    // Step 5: getDataRequestById is called with the inserted id and its result is returned.
    expect(getDataRequestStub).to.have.been.calledOnceWith('dr-1');
    expect(result.status).to.equal('requested');
  });

  it('updateDataRequest delegates to repository', async () => {
    const mockDB = getMockDBConnection();
    const service = new DataRequestService(mockDB);

    const updateStub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves();
    const payload: UpdateDataRequest = { reason: 'Updated reason' };

    const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

    expect(updateStub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
    expect(result).to.be.undefined;
  });
});
