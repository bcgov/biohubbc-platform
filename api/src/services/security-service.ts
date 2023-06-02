import { IDBConnection } from '../database/db';
import { PersecutionAndHarmSecurity, SecurityRepository } from '../repositories/security-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/security-service');

/**
 * A service for maintaining securty artifacts.
 *
 * @export
 * @class SecurityService
 */
export class SecurityService extends DBService {
  securityRepository: SecurityRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.securityRepository = new SecurityRepository(connection);
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

    await Promise.all(artifactIds.map(this.securityRepository.removeAllSecurityRulesFromArtifact));
  }
}
