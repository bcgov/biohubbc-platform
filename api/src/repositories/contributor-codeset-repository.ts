// src/repositories/contributor-codeset-repository.ts
import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { CodesetFilters, CreateContributorCodeCategory, GetCodeset } from '../paths/codeset/index.interface';
import { BaseRepository } from './base-repository';

export class ContributorCodesetRepository extends BaseRepository {
  /**
   * Base query for getting codesets for contributing systems
   *
   * @param {Knex} knex
   * @param {CodesetFilters} filters
   * @returns {Knex.QueryBuilder}
   */
  private getCodesetsBaseQuery(knex: Knex, filters?: CodesetFilters): Knex.QueryBuilder {
    // Subquery: fetch categories with their codes
    const subquery = knex
      .select(
        'cc.code_category_id',
        'cc.name',
        'ccc.contributor_name',
        knex.raw(`
        jsonb_agg(
          jsonb_build_object(
            'code_name', c.name,
            'description', c.description
          )
          ORDER BY c.name
        ) FILTER (WHERE c.name IS NOT NULL) AS categories
      `)
      )
      .from('code_category as cc')
      .leftJoin('contributor_code as c', function () {
        this.on('cc.code_category_id', '=', 'c.code_category_id').andOnNull('c.record_end_date');
      })
      .leftJoin('contributor_code_category as ccc', function () {
        this.on('cc.code_category_id', '=', 'ccc.code_category_id').andOnNull('ccc.record_end_date');
      })
      .whereNull('cc.record_end_date')
      .groupBy('cc.code_category_id', 'cc.name', 'ccc.contributor_name');

    // Apply filters if present
    if (filters?.contributor_id) {
      subquery.where(function () {
        this.where(function () {
          this.where('c.contributor_id', filters.contributor_id).orWhereNull('c.contributor_id');
        }).andWhere(function () {
          this.where('ccc.contributor_id', filters.contributor_id).orWhereNull('ccc.contributor_id');
        });
      });
    }

    if (filters?.code_category_name) {
      subquery.where('cc.name', filters.code_category_name);
    }

    // Final aggregation query
    return knex
      .select(
        knex.raw(`
        jsonb_build_object(
          'categories',
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'name', COALESCE(category_codes.contributor_name, category_codes.name),
                'codes', category_codes.codes
              )
              ORDER BY COALESCE(category_codes.contributor_name, category_codes.name)
            ) FILTER (WHERE category_codes.name IS NOT NULL),
            '[]'::jsonb
          )
        ) AS result
      `)
      )
      .from(subquery.as('category_codes'));
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

    const query = this.getCodesetsBaseQuery(knex, filters);

    const response = await this.connection.knex(query, GetCodeset);

    return response.rows[0];
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
        code_category_id
      )
      SELECT ${contributorId}, code_category_id
      FROM w_existing_category
    )
    INSERT INTO contributor_code (
      code_category_id,
      value,
      name
    )
    SELECT 
      wec.code_category_id,
      codes.value,
      codes.name
    FROM w_existing_category wec,
    (VALUES `;

    // Add the actual code values - e.g., ("1", "cold"), ("2", "mild"), ("3", "hot")
    const codeValues = category.codes.map((code) => SQL`(${code.value}, ${code.name})`);

    // Join the values together
    codeValues.forEach((codeValue, index) => {
      sqlStatement.append(codeValue);
      if (index < codeValues.length - 1) {
        sqlStatement.append(SQL`,`);
      }
    });

    sqlStatement.append(SQL`) AS codes(value, name);`);

    await this.connection.sql(sqlStatement);
  }
}
