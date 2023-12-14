import { IDBConnection } from '../database/db';
import { HTTP403 } from '../errors/http-error';
import {
  ArtifactPersecution,
  PersecutionAndHarmSecurity,
  SecurityRepository,
  SecurityRuleRecord,
  SECURITY_APPLIED_STATUS,
  SubmissionFeatureSecurityRecord
} from '../repositories/security-repository';
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
   * Get Security Status by Artifact Id.
   *
   * @param {number} artifactId
   * @return {*}  {Promise<SECURITY_APPLIED_STATUS>}
   * @memberof SecurityService
   */
  async getSecurityAppliedStatus(artifactId: number): Promise<SECURITY_APPLIED_STATUS> {
    defaultLog.debug({ label: 'getSecurityAppliedStatus' });

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
   * Get Artifact Supplementary Data.
   *
   * @param {number} artifactId
   * @param {boolean} isAdmin
   * @return {*}  {Promise<{ persecutionAndHarmRules: ArtifactPersecution[]; persecutionAndHarmStatus: SECURITY_APPLIED_STATUS }>}
   * @memberof SecurityService
   */
  async getArtifactSupplementaryData(
    artifactId: number,
    isAdmin: boolean
  ): Promise<{ persecutionAndHarmRules: ArtifactPersecution[]; persecutionAndHarmStatus: SECURITY_APPLIED_STATUS }> {
    defaultLog.debug({ label: 'getArtifactSupplementaryData' });

    let persecutionAndHarmRules: ArtifactPersecution[] = [];

    //If user is Admin, get all rules
    if (isAdmin) {
      persecutionAndHarmRules = await this.getPersecutionAndHarmRulesByArtifactId(artifactId);
    }

    let persecutionAndHarmStatus = await this.getSecurityAppliedStatus(artifactId);
    //If user is not Admin and status is pending, set to secured
    if (!isAdmin && persecutionAndHarmStatus === SECURITY_APPLIED_STATUS.PENDING) {
      persecutionAndHarmStatus = SECURITY_APPLIED_STATUS.SECURED;
    }

    return {
      persecutionAndHarmRules: persecutionAndHarmRules,
      persecutionAndHarmStatus: persecutionAndHarmStatus
    };
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

  /**
   *
   *
   * @param {number} artifactId
   * @param {number[]} securityReasonIds
   * @return {*}  {Promise<{ artifact_persecution_id: number }[]>}
   * @memberof SecurityService
   */
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
  /**
   *
   *
   * @param {number} artifactId
   * @param {number} securityReasonId
   * @return {*}  {Promise<void>}
   * @memberof SecurityService
   */
  async deleteSecurityRuleFromArtifact(artifactId: number, securityReasonId: number): Promise<void> {
    defaultLog.debug({ label: 'deleteSecurityRuleFromArtifact' });

    await this.securityRepository.deleteSecurityRuleFromArtifact(artifactId, securityReasonId);
  }

  /**
   * Returns the signed URL of a document for which a user has permissions.
   *
   * Rules:
   * non-admin user cannot access the document when:
   * - it is pending review, OR
   * - user hasn't been granted an exception to every security rule
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

    const isArtifactPendingReview = await this.isArtifactPendingReview(artifactId);

    //non-admin user cannot access a document pending review
    if (!isSystemUserAdmin && isArtifactPendingReview) {
      throw new HTTP403('You do not have access to this document.');
    }

    const artifactSecurityRuleIds = await this.getArtifactPersecutionAndHarmRulesIds(artifactId);

    const pers_harm_exceptionIds = await this.getPersecutionAndHarmExceptionsIdsByUser(userId);

    const userHasExceptionsToAllRules = artifactSecurityRuleIds.every((rule) => pers_harm_exceptionIds.includes(rule));

    //non-admin user cannot access a document if they don't have exceptions to all the rules applied to that document
    if (
      !isSystemUserAdmin &&
      !isArtifactPendingReview &&
      artifactSecurityRuleIds.length > 0 &&
      !userHasExceptionsToAllRules
    ) {
      throw new HTTP403('You do not have access to this document.');
    }

    // access is granted because
    // 1) admin (isSystemAdmin is true)
    // 2) document is unsecured (not pending review, and has no security rules applied)
    // 3) non-admin user has exceptions all security rules

    const artifact = await this.artifactService.getArtifactById(artifactId);

    return getS3SignedURL(artifact.key);
  }

  /**
   * Get the persecution or harm rules for which a user is granted exception
   *
   * @param {number} userId
   * @return {*}  {Promise<number[]>}
   * @memberof SecurityService
   */
  async getPersecutionAndHarmExceptionsIdsByUser(userId: number): Promise<number[]> {
    defaultLog.debug({ label: 'getPersecutionAndHarmExceptionsIdsByUser' });

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
  async getArtifactPersecutionAndHarmRulesIds(artifactId: number): Promise<number[]> {
    defaultLog.debug({ label: 'getDocumentPersecutionAndHarmRulesIds' });
    return (await this.securityRepository.getDocumentPersecutionAndHarmRules(artifactId)).map(
      (item) => item.persecution_or_harm_id
    );
  }

  /**
   * Returns true if security_review_timestamp is null
   *
   * Context: A null security_review_timestamp indicates that the artifact is pending review
   * Otherwise, the timestamp indicates that the artifact has been reviewed, and either has security rules applied or it,
   * or the artifact has no security rules( the reviewer did not apply security rules)
   *
   * @param {number} artifactId
   * @return {*}  {Promise<boolean>}
   * @memberof SecurityService
   */
  async isArtifactPendingReview(artifactId: number): Promise<boolean> {
    const artifact = await this.artifactService.getArtifactById(artifactId);
    return artifact.security_review_timestamp ? false : true;
  }

  /**
   * Returns true is any artifacts in the dataset are pending review
   *
   * @param {string} datasetId
   * @return {*}  {Promise<boolean>}
   * @memberof SecurityService
   */
  async isDatasetPendingReview(datasetId: string): Promise<boolean> {
    const artifactIds = (await this.artifactService.getArtifactsByDatasetId(datasetId)).map((item) => item.artifact_id);

    const artifactSecurityRules = await Promise.all(
      artifactIds.map(async (artifactId) => await this.isArtifactPendingReview(artifactId))
    );

    const isPendingReview = artifactSecurityRules.includes(true);

    return isPendingReview;
  }

  async applySecurityRulesToSubmissionFeatures(
    features: number[],
    rules: number[],
    override = false
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    if (override) {
      console.log('WE ARE OVERRIDING THIS');
      // we want to override any security rules present and can achieve this by remove everything first
      await this.securityRepository.removeSecurityRulesFromSubmissionFeatures(features);
    }

    return this.securityRepository.applySecurityRulesToSubmissionFeatures(features, rules);
  }

  async removeSecurityRulesFromSubmissionFeatures(submissions: number[]): Promise<SubmissionFeatureSecurityRecord[]> {
    return this.securityRepository.removeSecurityRulesFromSubmissionFeatures(submissions);
  }

  async getSecurityRulesForSubmissionFeatures(): Promise<any[]> {
    return [];
  }

  async getActiveSecurityRules(): Promise<SecurityRuleRecord[]> {
    return this.securityRepository.getActiveSecurityRules();
  }
}
