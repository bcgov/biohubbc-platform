import { IDBConnection } from '../database/db';
import { HTTP401, HTTP403 } from '../errors/http-error';
import { PersecutionAndHarmSecurity, SecurityRepository } from '../repositories/security-repository';
import { getS3SignedURL } from '../utils/file-utils';
import { getLogger } from '../utils/logger';
import { ArtifactService } from './artifact-service';
import { DBService } from './db-service';
import { UserService } from './user-service';

const defaultLog = getLogger('services/security-service');

/**
 * A service for maintaining securty artifacts.
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
   * Determines ability to download a document based on the security status of the document
   * as well as user permissions.
   *
   * Rules:
   * non-admin user cannot access the document when:
   ** it is pending review, OR
   ** user hasn't been granted an exception to every security rule
   *
   * @param {number} artifactId
   * @return {*}  {Promise<any>}
   * @memberof SecurityService
   */
  async getSecuredArtifactBasedOnRulesAndPermissions(artifactId: number): Promise<any> {
    const isSystemUserAdmin = await this.userService.isSystemUserAdmin();

    const userId = this.connection.systemUserId();

    const isDocumentPendingReview = (await this.artifactService.getArtifactById(artifactId)).security_review_timestamp
      ? false
      : true;

    if (!isSystemUserAdmin && isDocumentPendingReview) {
      throw new HTTP401('You do not have access to this document - it is pending review');
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
      throw new HTTP403('You do not have access to this document');
    }

    // access is granted because
    // 1) admin
    // 2) document is unsecured (not pending review, and has no security rules)
    // 3) non-admin has exceptions all security rules
    const response = await this.artifactService.getArtifactById(artifactId);
    return await getS3SignedURL(response.key);
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
