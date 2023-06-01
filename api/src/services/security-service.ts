import { IDBConnection } from '../database/db';
import { Artifact } from '../repositories/artifact-repository';
import { PersecutionAndHarmSecurity, SecurityReason, SecurityRepository } from '../repositories/security-repository';
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
   * Apply security rules to an artifact.
   *
   * @param {SecurityReason[]} securityReasons
   * @param {Artifact[]} selectedArtifacts
   * @return {*}  {(Promise<({ artifact_persecution_id: number } | undefined)[]>)}
   * @memberof SecurityService
   */
  async applySecurityRulesToArtifacts(
    securityReasons: SecurityReason[],
    selectedArtifacts: Artifact[]
  ): Promise<{ artifact_persecution_id: number }[][]> {
    defaultLog.debug({ label: 'applySecurityRulesToArtifacts' });

    const promise1 = selectedArtifacts.map(async (artifact) => {
      const promise2 = securityReasons.map(async (securityReason) => {
        return this.securityRepository.applySecurityRulesToArtifact(artifact.artifact_id, securityReason.id);
      });
      return Promise.all(promise2);
    });

    return Promise.all(promise1);
  }

  /**
   * Apply security rules to an artifact.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<void>}
   * @memberof SecurityService
   */
  async removeAllSecurityRulesFromArtifact(selectedArtifacts: Artifact[]): Promise<void> {
    defaultLog.debug({ label: 'removeAllSecurityRulesFromArtifact' });

    const promise1 = selectedArtifacts.map(async (artifact) => {
      return this.securityRepository.removeAllSecurityRulesFromArtifact(artifact.artifact_id);
    });

    await Promise.all(promise1);
  }
}
