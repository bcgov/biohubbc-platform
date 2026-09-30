import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ITicketReference } from 'interfaces/useTicketsApi.interface';
import { searchQueryKeys } from './search-query-keys';
import { submissionQueryKeys } from './submission-query-keys';
import { teamPolicyQueryKeys } from './team-policy-query-keys';
import { teamQueryKeys } from './team-query-keys';
import { ticketQueryKeys } from './ticket-query-keys';
import { userQueryKeys } from './user-query-keys';
import { downloadQueryKeys } from './download-query-keys';
import { policyQueryKeys } from './policy-query-keys';

/**
 * A ticket's detail through either scope's endpoints: what a change to its timeline, assignees, references or data
 * requests makes out of date. The lists show only its slug, subject, priority, status and created date.
 *
 * @param {string} ticketId The ticket that changed.
 * @returns The keys to refresh.
 */
const ticketDetail = (ticketId: string) => [
  ticketQueryKeys.detail('admin', ticketId),
  ticketQueryKeys.detail('user', ticketId)
];

/**
 * Every cached copy of a ticket: its detail, and the lists that show its status, subject and priority. A change to
 * any of those fields, or the ticket's removal, makes all of them out of date.
 *
 * @param {string} ticketId The ticket that changed.
 * @returns The keys to refresh.
 */
const ticket = (ticketId: string) => [
  ...ticketDetail(ticketId),
  ticketQueryKeys.lists('admin'),
  ticketQueryKeys.lists('user')
];

/**
 * The detail of both tickets a reference links, since each lists the reference.
 *
 * @param {Pick<ITicketReference, 'source_ticket_id' | 'target_ticket_id'>} reference The reference that changed.
 * @returns The keys to refresh.
 */
const ticketReference = (reference: Pick<ITicketReference, 'source_ticket_id' | 'target_ticket_id'>) => [
  ...ticketDetail(reference.source_ticket_id),
  ...ticketDetail(reference.target_ticket_id)
];

/**
 * The ticket lists, which a new ticket joins whether an administrator, a data request or a submission created it.
 *
 * @returns The keys to refresh.
 */
const ticketLists = () => [ticketQueryKeys.lists('admin'), ticketQueryKeys.lists('user')];

/**
 * Every ticket's detail. A ticket's timeline shows the current state of the data requests (policies) and upload
 * reviews it links to, so a change to one of those makes any ticket out of date.
 *
 * @returns The keys to refresh.
 */
const ticketDetails = () => [ticketQueryKeys.details('admin'), ticketQueryKeys.details('user')];

/**
 * Everything cached about policies, and the team assignments that name them. A data request is a policy.
 *
 * @returns The keys to refresh.
 */
const policy = () => [[QUERY_KEY_ROOT.POLICY], teamPolicyQueryKeys.lists()];

/**
 * The copies of a policy outside its own page: the policies and assignments tables, and the ticket timelines that show
 * the status of the data requests (policies) they link to.
 *
 * @returns The keys to refresh.
 */
const policyListings = () => [policyQueryKeys.lists(), teamPolicyQueryKeys.lists(), ...ticketDetails()];

/**
 * A ticket's data request: the ticket's detail, and the policy pages, since a data request is a policy.
 *
 * @param {string} ticketId The ticket the data request belongs to.
 * @returns The keys to refresh.
 */
const dataRequest = (ticketId: string) => [...ticketDetail(ticketId), ...policy()];

/**
 * Everything cached about teams, the team assignments that name them, and the policies that list their teams.
 *
 * @returns The keys to refresh.
 */
const team = () => [[QUERY_KEY_ROOT.TEAM], teamPolicyQueryKeys.lists(), [QUERY_KEY_ROOT.POLICY]];

/**
 * The team assignments, and the policies that list their teams.
 *
 * @returns The keys to refresh.
 */
const teamPolicy = () => [teamPolicyQueryKeys.lists(), [QUERY_KEY_ROOT.POLICY]];

/**
 * Security categories and reasons, and the reviews that show them as rules.
 *
 * @returns The keys to refresh.
 */
const securityReason = () => [[QUERY_KEY_ROOT.SECURITY], [QUERY_KEY_ROOT.SUBMISSION_UPLOAD]];

/**
 * A review's status, which ticket timelines and the dashboard's reviewed and unreviewed lists show.
 *
 * @returns The keys to refresh.
 */
const reviewStatus = () => [...ticketDetails(), submissionQueryKeys.adminLists()];

/**
 * A decision on a submission upload, which changes the timeline of the ticket it belongs to, the submission everywhere
 * it is listed, and what feature searches can find.
 *
 * @param {string} ticketId The ticket the upload belongs to.
 * @returns The keys to refresh.
 */
const uploadDecision = (ticketId: string) => [
  ...ticketDetail(ticketId),
  [QUERY_KEY_ROOT.SUBMISSION],
  searchQueryKeys.features()
];

/**
 * A submission's features, whose security the rules applied in a review change.
 *
 * @param {number} submissionId The submission reviewed.
 * @returns The keys to refresh.
 */
const submissionSecurity = (submissionId: number) => [submissionQueryKeys.submission(submissionId)];

/**
 * A new submission, which joins the submission lists and opens a ticket.
 *
 * @returns The keys to refresh.
 */
const submissionCreated = () => [[QUERY_KEY_ROOT.SUBMISSION], ...ticketLists()];

/**
 * The system users list, the user pickers that search it, and the signed-in user's own record, whose roles decide
 * which pages they can open when the changed user is them.
 *
 * @returns The keys to refresh.
 */
const systemUser = () => [userQueryKeys.lists(), userQueryKeys.availableAll(), userQueryKeys.selfAll()];

/**
 * The teams tables, which show each team's member count.
 *
 * @returns The keys to refresh.
 */
const teamMembership = () => [teamQueryKeys.lists()];

/**
 * The downloads lists, which a new download joins.
 *
 * @returns The keys to refresh.
 */
const download = () => [downloadQueryKeys.lists()];

/**
 * The places a new export is listed: the downloads lists, which show each download's exports, and its version's
 * exports table. The download and version records do not carry exports.
 *
 * @param {string} downloadId The download exported.
 * @param {string} downloadVersionId The version exported.
 * @returns The keys to refresh.
 */
const downloadExport = (downloadId: string, downloadVersionId: string) => [
  downloadQueryKeys.lists(),
  downloadQueryKeys.versionExportsAll(downloadId, downloadVersionId)
];

/**
 * The cached queries each kind of change makes out of date, beyond the query the change is written to. Pass them to
 * `refreshChangedQueries`; this module is the one place that records which pages show which data.
 */
export const changedQueryKeys = {
  ticketDetail,
  ticket,
  ticketReference,
  ticketLists,
  ticketDetails,
  policy,
  policyListings,
  dataRequest,
  team,
  teamPolicy,
  securityReason,
  reviewStatus,
  uploadDecision,
  submissionSecurity,
  submissionCreated,
  systemUser,
  teamMembership,
  download,
  downloadExport
};
