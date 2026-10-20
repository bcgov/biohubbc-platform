// Integration test for tag rule evaluation against a real database.
//
// Verifies the SQL that unit tests cannot: a rule expression evaluated against submission upload features, a rule
// expression compared with data request expressions (shared properties, and taxa including descendants), and that
// rules only add tags, never tag a ticket twice, and leave manual tags alone.
//
// Uses a transaction that is ROLLED BACK after each test. pg-boss is not running in the `make test-db` environment,
// so job publishing is stubbed and evaluation is called directly.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { ExpressionTree } from '../../models/expression-tree';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { DataRequestService } from '../../services/data-request-service';
import { TagRuleEvaluationService } from '../../services/tag-rule-evaluation-service';
import { TagRuleService } from '../../services/tag-rule-service';
import { TagService } from '../../services/tag-service';
import { TicketService } from '../../services/ticket-service';
import { TicketTagService } from '../../services/ticket-tag-service';
import { allOf, predicate } from '../helpers/test-expression-helpers';
import {
  createAssignedFeatureProperty,
  createTaxon,
  createTestUpload,
  insertPendingFeature
} from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Tag rule evaluation (integration)', function () {
  this.timeout(20000);

  let connection: IDBConnection;
  let tagService: TagService;
  let tagRuleService: TagRuleService;
  let evaluationService: TagRuleEvaluationService;
  let ticketTagService: TicketTagService;
  let runId: string;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    sinon
      .stub(TagRuleEvaluationService.dependencies, 'publishEvaluateTicketTagRulesJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });

    connection = getAPIUserDBConnection();
    await connection.open();
    tagService = new TagService(connection);
    tagRuleService = new TagRuleService(connection);
    evaluationService = new TagRuleEvaluationService(connection);
    ticketTagService = new TicketTagService(connection);
    runId = randomUUID().slice(0, 8);

    // Only this suite's rules take part in evaluation.
    await connection.sql(SQL`UPDATE tag_rule SET is_enabled = false WHERE is_enabled`);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    await connection.release();
  });

  async function createTag(name: string): Promise<string> {
    const tag = await tagService.createTag({ name: `${name}-${runId}`, description: null, color: '#336699' });
    return tag.tag_id;
  }

  async function createRule(tagId: string, expression: ExpressionTree): Promise<string> {
    const tagRule = await tagRuleService.createTagRule(tagId, {
      name: `Rule-${randomUUID()}`,
      description: null,
      expression
    });
    return tagRule.tag_rule_id;
  }

  /**
   * Evaluate a ticket and return its active tag ids.
   */
  async function evaluate(ticketId: string): Promise<string[]> {
    await evaluationService.evaluateTicketTagRules(ticketId);
    const ticketTags = await ticketTagService.getTicketTags(ticketId);
    return ticketTags.tags.map((tag) => tag.tag_id);
  }

  describe('submission upload tickets', () => {
    let submissionId: number;
    let submissionUploadId: string;
    let ticketId: string;
    let featurePropertyId: number;
    let assignmentId: number;

    beforeEach(async () => {
      submissionId = await createTestSubmission(connection);
      submissionUploadId = await createTestUpload(connection, submissionId);
      const upload = await connection.sql(
        SQL`SELECT ticket_id FROM submission_upload WHERE submission_upload_id = ${submissionUploadId}`
      );
      ticketId = upload.rows[0].ticket_id;

      const property = await createAssignedFeatureProperty(connection, 'string', ['survey']);
      featurePropertyId = property.featurePropertyId;
      assignmentId = property.assignments.survey;
    });

    async function addFeature(value: string): Promise<void> {
      const featureId = await insertPendingFeature(connection, submissionId, submissionUploadId, 'survey');
      await connection.sql(SQL`
        INSERT INTO submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id, value)
        VALUES (${featureId}, ${assignmentId}, ${value})
      `);
    }

    const equalsExpression = (value: string) => allOf(predicate(featurePropertyId, 'Equals', value));

    it('adds the tag of each rule a feature of the upload matches', async () => {
      await addFeature('elk');
      const elkTagId = await createTag('Elk');
      const deerTagId = await createTag('Deer');
      await createRule(elkTagId, equalsExpression('elk'));
      await createRule(deerTagId, equalsExpression('deer'));

      expect(await evaluate(ticketId)).to.eql([elkTagId]);
    });

    it('records the rule that applied a tag, and is harmless to repeat', async () => {
      await addFeature('elk');
      const tagId = await createTag('Elk');
      const tagRuleId = await createRule(tagId, equalsExpression('elk'));

      expect(await evaluate(ticketId)).to.eql([tagId]);
      expect(await evaluate(ticketId)).to.eql([tagId]);

      const ticketTags = await ticketTagService.getTicketTags(ticketId);
      expect(ticketTags.tags[0]).to.include({ tag_rule_id: tagRuleId });
      expect(ticketTags.events).to.have.length(1);
      expect(ticketTags.events[0].tag_rule_name).to.match(/^Rule-/);
    });

    it('does not re-add a tag an admin removed when the ticket is evaluated again', async () => {
      await addFeature('elk');
      const tagId = await createTag('Elk');
      await createRule(tagId, equalsExpression('elk'));
      expect(await evaluate(ticketId)).to.eql([tagId]);

      await ticketTagService.replaceTicketTags(ticketId, []);

      expect(await evaluate(ticketId)).to.eql([]);
    });

    it('does not re-add a removed tag through another rule with the same tag', async () => {
      await addFeature('elk');
      const tagId = await createTag('Elk');
      await createRule(tagId, equalsExpression('elk'));
      await createRule(tagId, allOf(predicate(featurePropertyId, 'StartsWith', 'el')));
      expect(await evaluate(ticketId)).to.eql([tagId]);

      await ticketTagService.replaceTicketTags(ticketId, []);

      expect(await evaluate(ticketId)).to.eql([]);
    });

    it('does not apply a tag that was removed manually before any rule matched', async () => {
      await addFeature('elk');
      const tagId = await createTag('Elk');
      await ticketTagService.replaceTicketTags(ticketId, [tagId]);
      await ticketTagService.replaceTicketTags(ticketId, []);
      await createRule(tagId, equalsExpression('elk'));

      expect(await evaluate(ticketId)).to.eql([]);
    });

    it('lets a rule that did not match at first match on a later evaluation', async () => {
      const tagId = await createTag('Elk');
      await createRule(tagId, equalsExpression('elk'));
      expect(await evaluate(ticketId)).to.eql([]);

      await addFeature('elk');

      expect(await evaluate(ticketId)).to.eql([tagId]);
    });

    it('leaves a manual tag in place and does not add the same tag again', async () => {
      await addFeature('elk');
      const tagId = await createTag('Manual');
      await ticketTagService.replaceTicketTags(ticketId, [tagId]);
      await createRule(tagId, equalsExpression('elk'));

      expect(await evaluate(ticketId)).to.eql([tagId]);
      expect((await ticketTagService.getTicketTags(ticketId)).tags[0].tag_rule_id).to.be.null;
    });

    it('skips disabled rules', async () => {
      await addFeature('elk');
      const tagId = await createTag('Disabled');
      const tagRuleId = await createRule(tagId, equalsExpression('elk'));
      await tagRuleService.updateTagRuleEnabled(tagId, tagRuleId, false);

      expect(await evaluate(ticketId)).to.eql([]);
    });

    it('deleting a rule can remove the tags it applied', async () => {
      await addFeature('elk');
      const tagId = await createTag('Removed');
      const tagRuleId = await createRule(tagId, equalsExpression('elk'));
      expect(await evaluate(ticketId)).to.eql([tagId]);

      await tagRuleService.deleteTagRule(tagId, tagRuleId, true);

      expect((await ticketTagService.getTicketTags(ticketId)).tags).to.eql([]);
    });

    it("lists only the tag's rules, a page at a time, and scopes rule access to the tag", async () => {
      const tagId = await createTag('Listed');
      const otherTagId = await createTag('Other');
      const first = await createRule(tagId, equalsExpression('elk'));
      const second = await createRule(tagId, equalsExpression('deer'));
      await createRule(otherTagId, equalsExpression('moose'));

      const firstPage = await tagRuleService.getTagRules(tagId, { page: 1, limit: 1 });
      const secondPage = await tagRuleService.getTagRules(tagId, { page: 2, limit: 1 });

      expect([...firstPage, ...secondPage].map((tagRule) => tagRule.tag_rule_id)).to.have.members([first, second]);
      expect(await tagRuleService.getTagRulesCount(tagId)).to.equal(2);

      try {
        await tagRuleService.getTagRule(otherTagId, first);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('deleting a tag deletes its rules', async () => {
      const tagId = await createTag('Deleted');
      const tagRuleId = await createRule(tagId, equalsExpression('elk'));

      await tagService.deleteTag(tagId);

      const tagRules = await tagRuleService.getTagRules(tagId);
      expect(tagRules.map((tagRule) => tagRule.tag_rule_id)).to.not.include(tagRuleId);
    });
  });

  describe('data request tickets', () => {
    it('matches rules whose expression refers to a property, or an ancestor taxon, of the request expression', async () => {
      const stringProperty = await createAssignedFeatureProperty(connection, 'string', ['survey']);
      const otherStringProperty = await createAssignedFeatureProperty(connection, 'string', ['survey']);
      const taxonProperty = await createAssignedFeatureProperty(connection, 'taxon', ['survey']);
      const tsnBase = 1_900_000_000 + Math.floor(Math.random() * 90_000_000);
      const parentTaxonId = await createTaxon(connection, `Parent ${runId}`, null, tsnBase);
      const childTaxonId = await createTaxon(connection, `Child ${runId}`, null, tsnBase + 1);
      await createTaxon(connection, `Unrelated ${runId}`, null, tsnBase + 2);
      await connection.sql(SQL`UPDATE taxon SET parent_taxon_id = ${parentTaxonId} WHERE taxon_id = ${childTaxonId}`);

      const ticket = await new TicketService(connection).createTicket({
        subject: `tag-rule-${runId}`,
        description: null,
        priority: 'medium',
        systemUserIds: []
      });
      await new DataRequestService(connection).createDataRequestForTicket(ticket.ticket_id, {
        requested_by: connection.systemUserId(),
        reason: 'Tag rule integration test',
        system_user_ids: [],
        featureTypes: ['survey'],
        expression: allOf(
          predicate(stringProperty.featurePropertyId, 'Equals', 'elk'),
          predicate(taxonProperty.featurePropertyId, 'Equals', tsnBase + 1)
        )
      });

      const sharedPropertyTag = await createTag('SharedProperty');
      const otherPropertyTag = await createTag('OtherProperty');
      const ancestorTaxonTag = await createTag('AncestorTaxon');
      const unrelatedTaxonTag = await createTag('UnrelatedTaxon');
      await createRule(sharedPropertyTag, allOf(predicate(stringProperty.featurePropertyId, 'Equals', 'deer')));
      await createRule(otherPropertyTag, allOf(predicate(otherStringProperty.featurePropertyId, 'Equals', 'elk')));
      await createRule(ancestorTaxonTag, allOf(predicate(taxonProperty.featurePropertyId, 'Equals', tsnBase)));
      await createRule(unrelatedTaxonTag, allOf(predicate(taxonProperty.featurePropertyId, 'Equals', tsnBase + 2)));

      expect(await evaluate(ticket.ticket_id)).to.have.members([sharedPropertyTag, ancestorTaxonTag]);
    });
  });
});
