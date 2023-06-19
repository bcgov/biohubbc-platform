import { IDBConnection } from '../database/db';
import { HTTP403 } from '../errors/http-error';
import { PersecutionAndHarmSecurity, SecurityRepository } from '../repositories/security-repository';
import { getS3SignedURL } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { ArtifactService } from './artifact-service';
import { DBService } from './db-service';
import { UserService } from './user-service';

const defaultLog = getLogger('services/security-service');

/**
 * A service for maintaining security artifacts.
 *
 * @export
 * @class SecurityService
 */
export class SecurityService extends DBService {
  securityRepository: SecurityRepository;
  artifactService: ArtifactService;
  userService: UserService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.securityRepository = new SecurityRepository(connection);
    this.artifactService = new ArtifactService(connection);
    this.userService = new UserService(connection);
  }

  /**
   * Get persecution and harm rules.
   *
   * @return {*}  {Promise<PersecutionAndHarmSecurity[]>}
   * @memberof SecurityService
   */
  async getPersecutionAndHarmRules(): Promise<PersecutionAndHarmSecurity[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRules' });

    return this.securityRepository.getPersecutionAndHarmRules();
  }

  /**
   * Apply security rules to all selected artifacts.
   *
   * @param {SecurityReason[]} securityReasons
   * @param {Artifact[]} selectedArtifacts
   * @return {*}  {(Promise<({ artifact_persecution_id: number } | undefined)[]>)}
   * @memberof SecurityService
   */
  async applySecurityRulesToArtifacts(
    artifactIds: number[],
    securityReasonIds: number[]
  ): Promise<{ artifact_persecution_id: number }[]> {
    defaultLog.debug({ label: 'applySecurityRulesToArtifacts' });

    const promises: Promise<{ artifact_persecution_id: number }>[] = artifactIds.reduce(
      (acc: Promise<{ artifact_persecution_id: number }>[], artifactId: number) => {
        securityReasonIds.forEach((securityReasonId: number) => {
          acc.push(this.securityRepository.applySecurityRulesToArtifact(artifactId, securityReasonId));
        });

        return acc;
      },
      []
    );

    return Promise.all(promises);
  }

  /**
   * Remove all security rules from an artifact.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<void>}
   * @memberof SecurityService
   */
  async removeAllSecurityRulesFromArtifact(artifactIds: number[]): Promise<void> {
    defaultLog.debug({ label: 'removeAllSecurityRulesFromArtifact' });

    await Promise.all(
      artifactIds.map(
        async (artifactId) => await this.securityRepository.removeAllSecurityRulesFromArtifact(artifactId)
      )
    );
  }

  /**
   * Returns the signed URL of a document for which a user has permissions.
   *
   * Rules:
   * non-admin user cannot access the document when:
   ** - it is pending review, OR
   ** - user hasn't been granted an exception to every security rule
   *
   * non-admin user can access the document when:
   * - document is not secured
   * - user has the correct exceptions
   *
   *
   * @param {number} artifactId
   * @return {*}  {Promise<any>}
   * @memberof SecurityService
   */
  async getSecuredArtifactBasedOnRulesAndPermissions(artifactId: number): Promise<any> {
    const isSystemUserAdmin = await this.userService.isSystemUserAdmin();

    const userId = this.connection.systemUserId();

    const artifact = await this.artifactService.getArtifactById(artifactId);

    const isDocumentPendingReview = artifact.security_review_timestamp ? false : true;

    if (!isSystemUserAdmin && isDocumentPendingReview) {
      throw new HTTP403('Documents that are pending review can only be downloaded by administrators.');
    }

    const documentSecurityRules = await this.getDocumentPersecutionAndHarmRules(artifactId);

    const pers_harm_exceptions = await this.getPersecutionAndHarmExceptionsByUser(userId);

    const userHasExceptionsToAllRules = documentSecurityRules.every((rule) => pers_harm_exceptions.includes(rule));

    if (
      !isSystemUserAdmin &&
      !isDocumentPendingReview &&
      documentSecurityRules.length > 0 &&
      !userHasExceptionsToAllRules
    ) {
      throw new HTTP403('You do not have access to this document.');
    }

    // access is granted because
    // 1) admin
    // 2) document is unsecured (not pending review, and has no security rules)
    // 3) non-admin has exceptions all security rules

    return getS3SignedURL(artifact.key);
  }

  /**
   * Get the persecution or harm rules for which a user is granted exception
   *
   * @param {number} userId
   * @return {*}  {Promise<number[]>}
   * @memberof SecurityService
   */
  async getPersecutionAndHarmExceptionsByUser(userId: number): Promise<number[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmExceptionsByUser' });

    return (await this.securityRepository.getPersecutionAndHarmRulesExceptionsByUserId(userId)).map(
      (item) => item.persecution_or_harm_id
    );
  }

  /**
   * Get the persecution and harm rules for a given artifact
   *
   * @param {number} artifactId
   * @return {*}  {Promise<number[]>}
   * @memberof SecurityService
   */
  async getDocumentPersecutionAndHarmRules(artifactId: number): Promise<number[]> {
    defaultLog.debug({ label: 'getDocumentPersecutionAndHarmRules' });
    return (await this.securityRepository.getDocumentPersecutionAndHarmRules(artifactId)).map(
      (item) => item.persecution_or_harm_id
    );
  }
}
