import { IDBConnection } from '../../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { CreateDownload, DownloadDetailRecord, DownloadId, DownloadListRecord } from '../../models/download';
import { DownloadExportListRow } from '../../models/download-export';
import { ExpressionTree } from '../../models/expression-tree';
import { publishProcessDownloadJob } from '../../queue/publisher';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { TeamService } from '../access-policy/team-service';
import { DBService } from '../db-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { DownloadPolicyService } from './download-policy-service';

export interface CreateDownloadRequestPayload {
  name: string;
  description: string | null;
  featureTypes: string[];
  expression: ExpressionTree | null;
  requestedBy: number | null;
}

/**
 * Result of creating a download request.
 */
export interface CreateDownloadRequestResult {
  download_id: string;
}

/**
 * Request-time service for downloads.
 *
 * Owns all operations called by path handlers during HTTP requests:
 * CRUD, request creation, access control, and team linking. Composes
 * TeamService + repositories.
 *
 * Background processing (Parquet generation, S3 upload) lives in
 * DownloadPipelineService.
 *
 * @export
 * @class DownloadService
 * @extends {DBService}
 */
export class DownloadService extends DBService {
  downloadRepository: DownloadRepository;
  /**
   * Held directly (not via `DownloadExportService`) to avoid a circular
   * construction chain — `DownloadExportService` already composes `DownloadService`
   * for its auth helper, and layering a `DownloadExportService` dependency here
   * would loop at construction time.
   */
  downloadExportRepository: DownloadExportRepository;
  teamService: TeamService;
  expressionTreeService: ExpressionTreeService;
  downloadPolicyService: DownloadPolicyService;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   *
   * Wrapped in a thunk because `queue/publisher` imports `DownloadService` back, so a direct
   * function reference here would be in TDZ when the module cycle resolves through publisher
   * first. Resolving at call time sidesteps the cycle.
   */
  static readonly dependencies = {
    publishProcessDownloadJob: (
      ...args: Parameters<typeof publishProcessDownloadJob>
    ): ReturnType<typeof publishProcessDownloadJob> => publishProcessDownloadJob(...args)
  };

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.downloadExportRepository = new DownloadExportRepository(connection);
    this.teamService = new TeamService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.downloadPolicyService = new DownloadPolicyService(connection);
  }

  /**
   * Create a new download request.
   *
   * The returned download row is in `pending` status; the worker picks it up
   * via pg-boss (enqueued by the route handler) and writes one Parquet file
   * per feature type to S3, inserting one `artifact` + one `download_artifact`
   * row per file with real byte_size + checksum at the moment the file lands.
   *
   * Stub "pending" artifact rows are intentionally NOT created here — creating
   * them at request time presented a false "this download has a file" signal
   * before any bytes were written, and forced a second UPDATE once the worker
   * filled in byte_size/checksum. The worker is now the single owner of
   * artifact writes.
   *
   * @param {CreateDownload} payload - The download record to create.
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadService
   */
  async createDownload(payload: CreateDownload): Promise<DownloadId> {
    return this.downloadRepository.createDownload(payload);
  }

  /**
   * Create a download request end-to-end for an authenticated or anonymous user.
   *
   * Persists the optional expression tree, creates the owning download policy, creates the
   * download record, wires up access for the requester, and queues the worker job. The caller
   * (route handler) wraps this in a single transaction so a mid-flow failure leaves no orphan
   * rows.
   *
   * `requestedBy` is the security identity the export is built with: it is persisted to
   * `download.requested_by` (which drives the parquet security filter) and, for authenticated
   * requests, used to seed the single-member team. requested_by and the single-member team are
   * seeded from the same identity at creation: the person the content is filtered for is exactly
   * the person granted access. They diverge only later, via claim.
   *
   * An anonymous caller's only handle is the download UUID itself; the public download page lets
   * them watch status, and any later export is a separate user-initiated action.
   *
   * Authorization is enforced at export time, not create time — the worker re-evaluates
   * visibility against `requested_by`, so a user cannot export data they no longer have access
   * to by queuing a download earlier.
   *
   * @param {CreateDownloadRequestPayload} payload - Request payload.
   * @return {Promise<CreateDownloadRequestResult>} The created download identifier.
   * @memberof DownloadService
   */
  async createDownloadRequest(payload: CreateDownloadRequestPayload): Promise<CreateDownloadRequestResult> {
    let expressionId: string | null = null;
    if (payload.expression !== null) {
      const result = await this.expressionTreeService.writeExpressionTree(payload.expression);
      expressionId = result.expression_id;
    }

    const { policy_id } = await this.downloadPolicyService.createDownloadPolicy({
      name: payload.name,
      description: payload.description,
      featureTypes: payload.featureTypes,
      expressionId
    });

    const { download_id } = await this.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: payload.requestedBy
    });

    if (payload.requestedBy !== null) {
      await this.linkDownloadToNewTeam(
        download_id,
        payload.requestedBy,
        `Team for download ${download_id}`,
        'Team automatically created for download'
      );
    }
    // Anonymous: no team link — UUID is the credential.

    await DownloadService.dependencies.publishProcessDownloadJob(this.connection, { downloadId: download_id });

    return { download_id };
  }

  /**
   * Get a download record by ID.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadDetailRecord | null>}
   * @memberof DownloadService
   */
  async findDownloadById(downloadId: string): Promise<DownloadDetailRecord | null> {
    return this.downloadRepository.findDownloadById(downloadId);
  }

  /**
   * Get paginated download records with each download's exports attached.
   *
   * The page of downloads and the export rows for every download on that page
   * are loaded with two sequential queries (the second depends on the id set
   * from the first); exports are grouped by `download_id` in JS and spread
   * onto each download. Empty-page short-circuit skips the export query.
   *
   * Shape mirrors `TicketService.getTicket` — composed at the service layer
   * rather than via SQL aggregation so repositories stay single-SQL CRUD.
   * Pre-joining the exports lets the frontend render from props without a
   * per-row fetch or cache map.
   *
   * @param {number} systemUserId - The user ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<{ downloads: DownloadListRecord[]; count: number }>}
   * @memberof DownloadService
   */
  async getDownloadsByTeamMembership(
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<{ downloads: DownloadListRecord[]; count: number }> {
    const { downloads: baseDownloads, count } = await this.downloadRepository.getDownloadsByTeamMembership(
      systemUserId,
      pagination
    );

    if (baseDownloads.length === 0) {
      return { downloads: [], count };
    }

    const downloadIds = baseDownloads.map((d) => d.download_id);
    const exportRows = await this.downloadExportRepository.listDownloadExportsByDownloadIds(downloadIds);

    const exportsByDownloadId = groupExportsByDownloadId(exportRows);

    const downloads: DownloadListRecord[] = baseDownloads.map((d) => ({
      ...d,
      exports: exportsByDownloadId.get(d.download_id) ?? []
    }));

    return { downloads, count };
  }

  /**
   * Link a download to a team via the download_team join table.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} teamId - The team ID.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async createDownloadTeam(downloadId: string, teamId: string): Promise<void> {
    return this.downloadRepository.createDownloadTeam(downloadId, teamId);
  }

  /**
   * Mark a download as downloaded after the client has retrieved the export.
   *
   * Sets `downloaded_at` timestamp and status to `downloaded` (AC #3).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async markDownloadAsDownloaded(downloadId: string): Promise<void> {
    await this.downloadRepository.markDownloadAsDownloaded(downloadId);
  }

  /**
   * Authorize a user's access to a specific download.
   *
   * Single authorization path through download_team → team → team_member:
   *
   * 1. **Anonymous** (no download_team rows):
   *    Public access — the download UUID itself is the credential. Anyone with the link
   *    can access it. This supports unauthenticated "download now" flows where users
   *    don't have an account yet. The user can later claim the download via PUT.
   *
   * 2. **Team-based** (download_team rows exist):
   *    Any authenticated member of a team linked via download_team can access the download.
   *    Teams are created at download time for authenticated users, or when an anonymous
   *    download is claimed.
   *
   * Throws HTTP403 if the user is not a member of any linked team.
   *
   * @param {string} downloadId - The download ID.
   * @param {number | null} systemUserId - The authenticated user's ID, or null if unauthenticated.
   * @return {Promise<DownloadDetailRecord>} The download record (avoids a second fetch by the caller).
   * @memberof DownloadService
   */
  async getAuthorizedDownload(downloadId: string, systemUserId: number | null): Promise<DownloadDetailRecord> {
    const download = await this.downloadRepository.findDownloadById(downloadId);

    if (!download) {
      throw new HTTP404('Download not found');
    }

    // Anonymous downloads have no team associations — UUID is the credential
    const hasTeams = await this.downloadRepository.isDownloadClaimedByTeam(downloadId);
    if (!hasTeams) {
      return download;
    }

    // Team-based downloads require an authenticated user
    if (systemUserId === null) {
      throw new HTTP403('Access denied');
    }

    // Check team membership via download_team
    const authorized = await this.downloadRepository.isUserAuthorizedForDownload(downloadId, systemUserId);
    if (!authorized) {
      throw new HTTP403('Access denied');
    }

    return download;
  }

  /**
   * Whether the download has been claimed by a team (i.e. has download_team rows).
   *
   * A teamless download is anonymous/public-by-link: the UUID is the credential and its parquet
   * was built with `requested_by IS NULL`. Callers use this to keep anonymous downloads to their
   * single auto-chained export — additional exports require claiming the download first.
   */
  async isDownloadClaimedByTeam(downloadId: string): Promise<boolean> {
    return this.downloadRepository.isDownloadClaimedByTeam(downloadId);
  }

  /**
   * Link a download to a new team containing the given user.
   *
   * Creates a single-member team and inserts a download_team row so
   * all subsequent access flows through download_team → team → team_member.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The user to add as team member.
   * @param {string} name - Display name for the team record.
   * @param {string} description - Descriptive text for the team record.
   * @return {Promise<void>}
   * @memberof DownloadService
   */
  async linkDownloadToNewTeam(
    downloadId: string,
    systemUserId: number,
    name: string,
    description: string
  ): Promise<void> {
    const team = await this.teamService.createTeam({
      name,
      description,
      system_user_ids: [systemUserId]
    });
    await this.downloadRepository.createDownloadTeam(downloadId, team.team_id);
  }

  /**
   * Claim an anonymous download for an authenticated user.
   *
   * Converts a UUID-only credential into team-based access by creating a team
   * and linking it via download_team. Fails if the download already has team
   * associations (already claimed) or doesn't exist.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The claiming user's ID.
   * @return {Promise<void>}
   * @throws {HTTP404} If the download doesn't exist.
   * @throws {HTTP409} If the download already has team associations.
   * @memberof DownloadService
   */
  async claimDownload(downloadId: string, systemUserId: number): Promise<void> {
    const download = await this.downloadRepository.findDownloadById(downloadId);

    if (!download) {
      throw new HTTP404('Download not found');
    }

    const hasTeams = await this.downloadRepository.isDownloadClaimedByTeam(downloadId);
    if (hasTeams) {
      throw new HTTP409('Download already claimed');
    }

    await this.linkDownloadToNewTeam(
      downloadId,
      systemUserId,
      `Team for download ${downloadId}`,
      'Team created when claiming anonymous download'
    );
  }
}

/**
 * Group a flat list of export rows by `download_id`.
 *
 * Preserves per-download-id order — the repository returns rows sorted by
 * `download_id` then `create_date DESC`, so the first occurrence of each id
 * seeds that id's bucket and subsequent rows append in the repo's order.
 */
export const groupExportsByDownloadId = (rows: DownloadExportListRow[]): Map<string, DownloadExportListRow[]> => {
  const grouped = new Map<string, DownloadExportListRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.download_id);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.download_id, [row]);
    }
  }
  return grouped;
};
