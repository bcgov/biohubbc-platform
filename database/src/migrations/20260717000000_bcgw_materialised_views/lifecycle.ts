import { Knex } from 'knex';
import { BCGW_SCHEMA } from './config';
import { MaterialisedViewCommentMap } from './types';
import { VIEW_SQL } from './views';

const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const addComments = async (knex: Knex, viewName: string, comments: MaterialisedViewCommentMap): Promise<void> => {
  for (const [column, comment] of Object.entries(comments)) {
    await knex.raw(`COMMENT ON COLUMN ${BCGW_SCHEMA}.${viewName}_new.${column} IS ${quoteLiteral(comment)};`);
  }
};

export const rebuildMaterialisedView = async (knex: Knex, view: (typeof VIEW_SQL)[number]): Promise<void> => {
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${view.name}_new;`);
  await knex.raw(view.sql);
  await addComments(knex, view.name, view.comments);
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${view.name};`);
  await knex.raw(`ALTER MATERIALIZED VIEW ${BCGW_SCHEMA}.${view.name}_new RENAME TO ${view.name};`);
};
