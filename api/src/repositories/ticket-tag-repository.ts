import { SQL } from 'sql-template-strings';
import { getKnex } from '../database/db';
import { TagId } from '../models/tag';
import { RuleTicketTag } from '../models/tag-rule';
import { TicketTagEvent, TicketTagSummary } from '../models/ticket-tag';
import { BaseRepository } from './base-repository';

/**
 * Repository for ticket_tag table operations.
 */
export class TicketTagRepository extends BaseRepository {
  /**
   * Get the active tags of a ticket ordered by case-insensitive name, with the rule that applied each.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketTagSummary[]>} Active tags linked to the ticket.
   * @memberof TicketTagRepository
   */
  async getTicketTagSummaries(ticketId: string): Promise<TicketTagSummary[]> {
    const knex = getKnex();
    const query = knex('ticket_tag')
      .select('tag.tag_id', 'tag.name', 'tag.color', 'ticket_tag.tag_rule_id', 'tag_rule.name as tag_rule_name')
      .join('tag', 'tag.tag_id', 'ticket_tag.tag_id')
      .leftJoin('tag_rule', 'tag_rule.tag_rule_id', 'ticket_tag.tag_rule_id')
      .where('ticket_tag.ticket_id', ticketId)
      .whereNull('ticket_tag.record_end_date')
      .whereNull('tag.record_end_date')
      .orderByRaw('lower(tag.name) ASC, tag.tag_id ASC');

    const response = await this.connection.knex(query, TicketTagSummary);

    return response.rows;
  }

  /**
   * Get the tag added/removed history of a ticket, oldest first.
   *
   * Each ticket_tag row yields an "added" event from its create audit columns and, once soft-deleted, a
   * "removed" event from its record_end_date and update_user. Events for since-deleted tags are kept.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketTagEvent[]>} Tag events for the ticket.
   * @memberof TicketTagRepository
   */
  async getTicketTagEvents(ticketId: string): Promise<TicketTagEvent[]> {
    const sqlStatement = SQL`
      SELECT
        tt.ticket_tag_id,
        tt.tag_id,
        tg.name AS tag_name,
        tg.color AS tag_color,
        'added' AS action,
        su.user_identifier,
        tr.name AS tag_rule_name,
        tt.create_date AS event_date
      FROM ticket_tag tt
      JOIN tag tg
        ON tg.tag_id = tt.tag_id
      LEFT JOIN tag_rule tr
        ON tr.tag_rule_id = tt.tag_rule_id
      LEFT JOIN "system_user" su
        ON su.system_user_id = tt.create_user
      WHERE tt.ticket_id = ${ticketId}

      UNION ALL

      SELECT
        tt.ticket_tag_id,
        tt.tag_id,
        tg.name AS tag_name,
        tg.color AS tag_color,
        'removed' AS action,
        su.user_identifier,
        tr.name AS tag_rule_name,
        tt.record_end_date AS event_date
      FROM ticket_tag tt
      JOIN tag tg
        ON tg.tag_id = tt.tag_id
      LEFT JOIN tag_rule tr
        ON tr.tag_rule_id = tt.tag_rule_id
      LEFT JOIN "system_user" su
        ON su.system_user_id = tt.update_user
      WHERE tt.ticket_id = ${ticketId}
        AND tt.record_end_date IS NOT NULL

      ORDER BY event_date ASC, action ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketTagEvent);

    return response.rows;
  }

  /**
   * Link tags to a ticket, skipping tags that are already actively linked and duplicate ids.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - Tag UUIDs to link.
   * @returns {Promise<TagId[]>} The tags newly linked.
   * @memberof TicketTagRepository
   */
  async insertTicketTags(ticketId: string, tagIds: string[]): Promise<TagId[]> {
    const sqlStatement = SQL`
      INSERT INTO ticket_tag (ticket_id, tag_id)
      SELECT ${ticketId}::uuid, requested.tag_id
      FROM (SELECT DISTINCT unnest(${tagIds}::uuid[]) AS tag_id) requested
      WHERE NOT EXISTS (
        SELECT 1
        FROM ticket_tag tt
        WHERE tt.ticket_id = ${ticketId}
          AND tt.tag_id = requested.tag_id
          AND tt.record_end_date IS NULL
      )
      RETURNING tag_id;
    `;

    const response = await this.connection.sql(sqlStatement, TagId);

    return response.rows;
  }

  /**
   * Soft delete the active tag links of a ticket whose tag is not in the given set.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {string[]} tagIds - Tag UUIDs to keep. Empty removes every link.
   * @returns {Promise<void>}
   * @memberof TicketTagRepository
   */
  async deleteTicketTagsNotIn(ticketId: string, tagIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE ticket_tag
      SET record_end_date = now()
      WHERE ticket_id = ${ticketId}
        AND tag_id <> ALL(${tagIds}::uuid[])
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Link tags to a ticket on behalf of the rules that matched it.
   *
   * A tag the ticket has ever had is skipped: an active tag from any source, and a tag that was removed (an ended
   * row), so a removed tag stays removed when the ticket is re-evaluated, whichever rule or admin added it. The
   * active-row unique index also absorbs two matching rules with the same tag and concurrent evaluations, which
   * makes retried and duplicate jobs harmless.
   *
   * @param {string} ticketId - Ticket UUID.
   * @param {RuleTicketTag[]} ruleTicketTags - Tags to link, each with the rule that matched.
   * @returns {Promise<TagId[]>} The tags newly linked.
   * @memberof TicketTagRepository
   */
  async insertRuleTicketTags(ticketId: string, ruleTicketTags: RuleTicketTag[]): Promise<TagId[]> {
    const tagIds = ruleTicketTags.map((ruleTicketTag) => ruleTicketTag.tag_id);
    const tagRuleIds = ruleTicketTags.map((ruleTicketTag) => ruleTicketTag.tag_rule_id);
    const sqlStatement = SQL`
      INSERT INTO ticket_tag (ticket_id, tag_id, tag_rule_id)
      SELECT ${ticketId}::uuid, requested.tag_id, requested.tag_rule_id
      FROM unnest(${tagIds}::uuid[], ${tagRuleIds}::uuid[]) AS requested(tag_id, tag_rule_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM ticket_tag tt
        WHERE tt.ticket_id = ${ticketId}
          AND tt.tag_id = requested.tag_id
      )
      ON CONFLICT (ticket_id, tag_id) WHERE record_end_date IS NULL DO NOTHING
      RETURNING tag_id;
    `;

    const response = await this.connection.sql(sqlStatement, TagId);

    return response.rows;
  }

  /**
   * Soft delete all active tag links applied by a rule.
   *
   * @param {string} tagRuleId - Tag rule UUID.
   * @returns {Promise<void>}
   * @memberof TicketTagRepository
   */
  async deleteTicketTagsByTagRuleId(tagRuleId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('ticket_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_rule_id', tagRuleId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete all active tag links of a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<void>}
   * @memberof TicketTagRepository
   */
  async deleteTicketTagsByTicketId(ticketId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('ticket_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('ticket_id', ticketId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }

  /**
   * Soft delete all active ticket links of a tag.
   *
   * @param {string} tagId - Tag UUID.
   * @returns {Promise<void>}
   * @memberof TicketTagRepository
   */
  async deleteTicketTagsByTagId(tagId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('ticket_tag')
      .update({ record_end_date: knex.fn.now() })
      .where('tag_id', tagId)
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
