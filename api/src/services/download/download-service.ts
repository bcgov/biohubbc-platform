import { SIGNED_URL_EXPIRY_FRAGMENT } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { HTTP403, HTTP404, HTTP409, HTTP500 } from '../../errors/http-error';
import {
  CreateDownload,
  DownloadFeatureSummary,
  DownloadId,
  DownloadListRecord,
  DownloadRecord
} from '../../models/download';
import { DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { TeamService } from '../access-policy/team-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { SearchFeatureService } from '../search-feature-service';

/**
 * Request-time service for downloads.
 *
 * Owns all operations called by path handlers during HTTP requests:
 * CRUD, request creation, access control, team linking, fragment listing,
 * and signed URL delivery. Composes TeamService + repositories.
 *
 * Background processing (fragment planning, streaming, S3 upload) lives
 * in DownloadPipelineService.
 *
 * @export
 * @class DownloadService
 * @extends {DBService}
 */
export class DownloadService extends DBService {
  downloadRepository: DownloadRepository;
  fragmentRepository: DownloadFragmentRepository;
  teamService: TeamService;
  searchFeatureService: SearchFeatureService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.fragmentRepository = new DownloadFragmentRepository(connection);
    this.teamService = new TeamService(connection);
    this.searchFeatureService = new SearchFeatureService(connection);
  }

  /**
   * Create a new download record.
   *
   * @param {CreateDownload} payload - The download record to create.
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadService
   */
  async createDownload(payload: CreateDownload): Promise<DownloadId> {
    return this.downloadRepository.createDownload(payload);
  }

  /**
   * Get a download record by ID.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadService
   */
  async findDownloadById(downloadId: string): Promise<DownloadRecord | null> {
    return this.downloadRepository.findDownloadById(downloadId);
  }

  /**
   * Get paginated download records accessible to a user, with total count.
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
    return this.downloadRepository.getDownloadsByTeamMembership(systemUserId, pagination);
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
   * Resolve all features included in a download.
   *
   * Branches based on the download's feature source:
   * - **Cart-based** (cart_id set): features resolved from cart_submission_feature.
   *   Cart downloads are frozen — checkout marks the cart as CHECKED_OUT, so
   *   cart_submission_feature rows don't change post-checkout.
   * - **Filter-based** (filters set): re-runs the search query at pipeline time,
   *   intentionally picking up newly ingested data matching the filters.
   *   The creator's security scope is recovered from `create_user` (set
   *   automatically by `tr_audit_trigger` on INSERT). The search CTE runs as
   *   a subquery inside the summary JOIN, keeping feature resolution in SQL
   *   and avoiding a 500K+ ID round-trip through JS.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFeatureSummary[]>} All features for this download.
   * @memberof DownloadService
   */
  async getDownloadFeatures(downloadId: string): Promise<DownloadFeatureSummary[]> {
    const source = await this.downloadRepository.getDownloadSource(downloadId);

    if (source.cart_id) {
      return this.downloadRepository.getDownloadFeaturesByCartId(source.cart_id);
    }

    if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );

      return this.downloadRepository.getDownloadFeaturesBySearchQuery(searchSubquery);
    }

    // CHECK constraint prevents this, but guard defensively
    throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
  }

  /**
   * Get all fragments for a download.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>}
   * @memberof DownloadService
   */
  async getFragmentsByDownloadId(downloadId: string): Promise<DownloadFragmentRecord[]> {
    return this.fragmentRepository.getFragmentsByDownloadId(downloadId);
  }

  /**
   * Mark a download as downloaded after the client has retrieved all fragments.
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
   * @return {Promise<DownloadRecord>} The download record (avoids a second fetch by the caller).
   * @memberof DownloadService
   */
  async getAuthorizedDownload(downloadId: string, systemUserId: number | null): Promise<DownloadRecord> {
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
      `Team for cart ${downloadId}`,
      'Team created when claiming anonymous download'
    );
  }

  /**
   * Get a signed URL for downloading a specific fragment.
   *
   * Validates the fragment exists and is ready before generating the URL.
   * Fragment delivery is a download-record concern (access control + URL generation),
   * not a pipeline concern (processing, streaming, S3 upload).
   *
   * @param {string} downloadId - The download ID.
   * @param {number} fragmentIndex - The zero-based fragment index.
   * @return {Promise<string>} The signed download URL.
   * @memberof DownloadService
   */
  async getFragmentSignedUrl(downloadId: string, fragmentIndex: number): Promise<string> {
    const fragments = await this.fragmentRepository.getFragmentsByDownloadId(downloadId);
    const fragment = fragments.find((f) => f.fragment_index === fragmentIndex);

    if (!fragment) {
      throw new HTTP404(`Fragment ${fragmentIndex} not found for download ${downloadId}`);
    }

    if (fragment.fragment_status !== DownloadStatusEnum.READY) {
      throw new HTTP409('Fragment is not ready');
    }

    if (!fragment.s3_key) {
      throw new HTTP500('Fragment record missing s3_key');
    }

    const objectStorageService = new ObjectStorageService();
    return objectStorageService.getSignedUrl(BucketType.MAIN, fragment.s3_key, SIGNED_URL_EXPIRY_FRAGMENT);
  }
}
