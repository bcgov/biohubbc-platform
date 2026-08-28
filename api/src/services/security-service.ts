import { IDBConnection } from '../database/db';
import { ArtifactPersecution, PersecutionAndHarmSecurity } from '../models/persecution-and-harm';
import {
  SubmissionFeatureSecurityRecord,
  SubmissionFeatureSecurityRulesSummary
} from '../models/submission-feature-security';
import { SECURITY_APPLIED_STATUS, SecurityRepository } from '../repositories/security-repository';
import { getLogger } from '../utils/logger';
import { SecurityScopeService } from './access-policy/security-scope-service';
import { DBService } from './db-service';
import { ArtifactService } from './old-artifact-service';

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
  securityScopeService: SecurityScopeService;

  constructor(connection: IDBConnection) {
    super(connection);

    this.securityRepository = new SecurityRepository(connection);
    this.artifactService = new ArtifactService(connection);
    this.securityScopeService = new SecurityScopeService(connection);
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
   * @param {number[]} securityReasonIds
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
   * Returns true is any artifacts in the survey are pending review
   *
   * @param {string} surveyId
   * @return {*}  {Promise<boolean>}
   * @memberof SecurityService
   */
  async isSurveyPendingReview(surveyId: string): Promise<boolean> {
    const artifactIds = (await this.artifactService.getArtifactsBySurveyId(surveyId)).map((item) => item.artifact_id);

    const artifactSecurityRules = await Promise.all(
      artifactIds.map(async (artifactId) => await this.isArtifactPendingReview(artifactId))
    );

    const isPendingReview = artifactSecurityRules.includes(true);

    return isPendingReview;
  }

  /**
   * Patches security rules that are applied or removed to the given set of submission features. If a
   * particular rule happens to belong to both `applyRuleIds` and `removeRuleIds`, it will always be
   * added.
   *
   * After mutations, triggers scope recomputation for all scopes covering the submission.
   * The recompute job (deleteStaleAnchorBatch + resolveUrnForScope + computeAnchorBatch) handles both
   * added and removed rules idempotently.
   *
   * @param {number} submissionId ID of the submission the features belong to.
   * @param {number[]} submissionFeatureIds IDs of the submission features whose security will be updated.
   * @param {number[]} applyRuleIds IDs of the rules which will be applied after the patch operation.
   * @param {number[]} removeRuleIds IDs of the rules which will be removed after the patch operation.
   * @returns {Promise<void>} Resolves after the mutations and anchor-recomputation jobs are queued.
   * @memberof SecurityService
   */
  async patchSecurityRulesOnSubmissionFeatures(
    submissionId: number,
    submissionFeatureIds: number[],
    applyRuleIds: number[],
    removeRuleIds: number[]
  ): Promise<void> {
    defaultLog.debug({ label: 'patchSecurityRulesOnSubmissionFeatures', applyRuleIds, removeRuleIds });

    if (!submissionFeatureIds.length) {
      return;
    }

    if (removeRuleIds.length > 0) {
      await this.securityRepository.removeSecurityRulesFromSubmissionFeatures(
        submissionId,
        submissionFeatureIds,
        removeRuleIds
      );
    }

    if (applyRuleIds.length > 0) {
      await this.securityRepository.applySecurityRulesToSubmissionFeatures(
        submissionId,
        submissionFeatureIds,
        applyRuleIds
      );
    }

    // Trigger scope recomputation — the recompute job handles both added and removed rules
    await this.securityScopeService.triggerAnchorComputationForSubmission(submissionId);
  }

  /**
   * Patches security rules applied or removed for all features of a submission.
   * If a rule exists in both applyRuleIds and removeRuleIds, it will always be applied.
   *
   * After mutations, triggers scope recomputation for all scopes covering the submission.
   * The recompute job (deleteStaleAnchorBatch + resolveUrnForScope + computeAnchorBatch) handles both
   * added and removed rules idempotently.
   *
   * @param {number} submissionId ID of the submission whose feature security should be updated.
   * @param {number[]} applyRuleIds IDs of rules to apply.
   * @param {number[]} removeRuleIds IDs of rules to remove.
   * @returns {Promise<void>} Resolves after the mutations and anchor-recomputation jobs are queued.
   * @memberof SecurityService
   */
  async patchSecurityRulesOnSubmission(
    submissionId: number,
    applyRuleIds: number[],
    removeRuleIds: number[]
  ): Promise<void> {
    defaultLog.debug({
      label: 'patchSecurityRulesOnSubmission',
      submissionId,
      applyRuleIds,
      removeRuleIds
    });

    // Remove rules first
    if (removeRuleIds?.length) {
      await this.securityRepository.removeSecurityFromSubmission(submissionId, removeRuleIds);
    }

    // Apply rules last (wins if overlap exists)
    if (applyRuleIds?.length) {
      await this.securityRepository.applySecurityToSubmission(submissionId, applyRuleIds);
    }

    // Trigger scope recomputation — the recompute job handles both added and removed rules
    await this.securityScopeService.triggerAnchorComputationForSubmission(submissionId);
  }

  /**
   * Gets Submission Feature Security Records for a given set of submission feature ids
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityService
   */
  async getSecurityRulesForSubmissionFeatures(
    submissionFeatureIds: number[]
  ): Promise<SubmissionFeatureSecurityRecord[]> {
    if (!submissionFeatureIds.length) {
      // no features, return early
      return [];
    }

    return this.securityRepository.getSecurityRulesForSubmissionFeatures(submissionFeatureIds);
  }

  /**
   * Gets all Security Records for all featues belonging to the given submission.
   *
   * @param {number} submissionId
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRulesSummary>}
   * @memberof SecurityService
   */
  async getSubmissionFeatureSecuritySummary(
    submissionId: number,
    submissionFeatureIds?: number[]
  ): Promise<SubmissionFeatureSecurityRulesSummary> {
    return this.securityRepository.getSubmissionFeatureSecuritySummary(submissionId, submissionFeatureIds);
  }
}
