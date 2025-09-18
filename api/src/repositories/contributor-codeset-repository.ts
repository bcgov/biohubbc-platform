import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../database/db';
import { CodesetFilters, CreateContributorCodeCategory, GetCodeset } from '../paths/codeset/index.interface';
import { BaseRepository } from './base-repository';

/**
 * Repository for interacting with and managing contributor codesets
 */
export class ContributorCodesetRepository extends BaseRepository {
  /**
   * Base query for getting codesets for contributing systems
   *
   * @param {Knex} knex
   * @param {CodesetFilters} filters
   * @returns {Knex.QueryBuilder}
   */
  private getCodesetsBaseQuery(knex: Knex, filters?: CodesetFilters): Knex.QueryBuilder {
    return knex
      .select(
        'ccc.contributor_code_category_id',
        'cc.name',
        'ccc.description',
        knex.raw(`
        jsonb_agg(
          jsonb_build_object(
            'contributor_code_id', c.contributor_code_id,
            'name', c.label,
            'value', c.value,
            'description', c.description
          )
          ORDER BY c.label
        ) FILTER (WHERE c.contributor_code_id IS NOT NULL) AS codes
      `)
      )
      .from('contributor_code_category as ccc')
      .innerJoin('code_category as cc', function () {
        this.on('ccc.code_category_id', '=', 'cc.code_category_id').andOnNull('cc.record_end_date');
      })
      .leftJoin('contributor_code as c', function () {
        this.on('ccc.code_category_id', '=', 'c.code_category_id').andOnNull('c.record_end_date');
      })
      .whereNull('ccc.record_end_date')
      .modify((qb) => {
        if (filters?.contributor_id) {
          qb.where('ccc.contributor_id', filters.contributor_id);
        }
        if (filters?.code_category_name) {
          qb.where('cc.name', filters.code_category_name);
        }
      })
      .groupBy('ccc.contributor_code_category_id', 'cc.name', 'ccc.description');
  }

  /**
   * Get codesets matching the provided filters.
   * Returns grouped results by category with their codes.
   *
   * @param {CodesetFilters} filters
   * @returns {Promise<GetCodeset>}
   */
  async getCodesets(filters?: CodesetFilters): Promise<GetCodeset> {
    const knex = getKnex();

    // Step 1: Get base query (subquery)
    const subquery = this.getCodesetsBaseQuery(knex, filters).as('category_codes');

    // Step 2: Wrap in final jsonb_build_object aggregation
    const finalQuery = knex
      .select(
        knex.raw(`
        jsonb_build_object(
          'categories',
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'contributor_code_category_id', category_codes.contributor_code_category_id,
                  'name', category_codes.name,
                  'description', category_codes.description,
                  'codes', category_codes.codes
                )
                ORDER BY category_codes.name
              ) FILTER (WHERE category_codes.name IS NOT NULL),
              '[]'::jsonb
            )
        ) AS result
      `)
      )
      .from(subquery);

    const response = await this.connection.knex(finalQuery, z.object({ result: GetCodeset }));

    return response.rows[0].result;
  }

  /**
   * Inserts a codeset category and set of codes for a given contributor system
   *
   * @param {number} contributorId
   * @param {CreateContributorCodeCategory} category
   * @return {Promise<void>}
   */
  async createCodesetCategory(contributorId: number, category: CreateContributorCodeCategory): Promise<void> {
    const sqlStatement = SQL`
      WITH w_code_category AS (
        INSERT INTO code_category (name)
        VALUES (${category.name})
        ON CONFLICT (name) DO NOTHING
        RETURNING code_category_id
      ),
      w_existing_category AS (
        SELECT code_category_id FROM w_code_category
        UNION
        SELECT code_category_id FROM code_category WHERE name = ${category.name}
      ),
      w_contributor_category AS (
        INSERT INTO contributor_code_category (
          contributor_id,
          code_category_id,
          description
        )
        SELECT ${contributorId}, code_category_id, ${category.description}
        FROM w_existing_category
        RETURNING code_category_id
      ),
      all_code_category AS (
        SELECT code_category_id FROM w_contributor_category
        UNION
        SELECT code_category_id FROM code_category WHERE name = ${category.name}
      )
      INSERT INTO contributor_code (
        code_category_id,
        value,
        label,
        description
      )
      SELECT 
        acc.code_category_id,
        codes.value,
        codes.label,
        codes.description
      FROM all_code_category acc,
      (VALUES `;

    // Prepare values for insertion
    const codeValues = category.codes.map((code) => SQL`(${code.value}, ${code.label}, ${code.description ?? null})`);

    // Append VALUES list
    codeValues.forEach((val, index) => {
      sqlStatement.append(val);
      if (index < codeValues.length - 1) {
        sqlStatement.append(SQL`,`);
      }
    });

    sqlStatement.append(SQL`) AS codes(value, label, description);`);

    await this.connection.sql(sqlStatement);
  }
}
