import { IDBConnection } from '../database/db';
import {
  ArtifactPersecution,
  PersecutionAndHarmSecurity,
  SecurityRepository,
  SECURITY_APPLIED_STATUS
} from '../repositories/security-repository';
import { getLogger } from '../utils/logger';
import { ArtifactService } from './artifact-service';
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
   * Get Security Status by Artifact Id.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<SECURITY_APPLIED_STATUS>}
   * @memberof SecurityService
   */
  async getSecurtyAppliedStatus(artifactId: number): Promise<SECURITY_APPLIED_STATUS> {
    defaultLog.debug({ label: 'getSecurtyAppliedStatus' });

    const artifactService = new ArtifactService(this.connection);

    const artifact = await artifactService.getArtifactById(artifactId);

    if (artifact.security_review_timestamp === null) {
      return SECURITY_APPLIED_STATUS.PENDING;
    }

    const persecutionAndHarmRules = await this.getPersecutionAndHarmRulesByArtifactId(artifactId);

    if (!persecutionAndHarmRules.length) {
      return SECURITY_APPLIED_STATUS.UNSECURED;
    }

    return SECURITY_APPLIED_STATUS.SECURED;
  }

  /**
   * Get persecution and harm rules by artifact ID.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<ArtifactPersecution[]>}
   * @memberof SecurityService
   */
  async getPersecutionAndHarmRulesByArtifactId(artifactId: number): Promise<ArtifactPersecution[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmRulesByArtifactId' });

    return this.securityRepository.getPersecutionAndHarmRulesByArtifactId(artifactId);
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

    const artifactService = new ArtifactService(this.connection);

    const promises: Promise<any>[] = [];

    for (const artifactId of artifactIds) {
      promises.push(this.applySecurityRulesToArtifact(artifactId, securityReasonIds));
      await artifactService.updateArtifactSecurityReviewTimestamp(artifactId);
    }

    return Promise.all(promises);
  }

  async applySecurityRulesToArtifact(
    artifactId: number,
    securityReasonIds: number[]
  ): Promise<{ artifact_persecution_id: number }[]> {
    defaultLog.debug({ label: 'applySecurityRulesToArtifact' });

    // Get any existing rules for this artifact
    const existingRules = await this.getPersecutionAndHarmRulesByArtifactId(artifactId);

    // Filter out any existing rules that are not in the new list
    const existingRulesToDelete = existingRules.filter((existingRule) => {
      return !securityReasonIds.includes(existingRule.persecution_or_harm_id);
    });

    // Delete any existing rules that are not in the new list
    if (existingRulesToDelete.length) {
      const promises: Promise<any>[] = [];

      existingRulesToDelete.forEach((existingRule) => {
        promises.push(
          this.securityRepository.deleteSecurityRuleFromArtifact(artifactId, existingRule.persecution_or_harm_id)
        );
      });

      await Promise.all(promises);
    }

    // Filter out any new rules that are already in the existing list
    const newRulesToAdd = securityReasonIds.filter((securityReasonId) => {
      return !existingRules.map((existingRule) => existingRule.persecution_or_harm_id).includes(securityReasonId);
    });

    const promises: Promise<any>[] = [];
    // Add any new rules that are not in the existing list
    newRulesToAdd.forEach((securityReasonId: number) => {
      promises.push(this.securityRepository.applySecurityRulesToArtifact(artifactId, securityReasonId));
    });

    return Promise.all(promises);
  }

  async deleteSecurityRuleFromArtifact(artifactId: number, securityReasonId: number): Promise<void> {
    defaultLog.debug({ label: 'deleteSecurityRuleFromArtifact' });

    await this.securityRepository.deleteSecurityRuleFromArtifact(artifactId, securityReasonId);
  }
}
