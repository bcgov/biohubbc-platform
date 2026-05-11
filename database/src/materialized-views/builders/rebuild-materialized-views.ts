import { Knex } from 'knex';
import { MATERIALIZED_VIEW_DEFINITIONS } from '../config/mv.definitions';
import { buildCommentsSQL } from './build-comments';
import { buildMaterializedViewSQL } from './build-materialized-view';

export async function rebuildMaterializedViews(knex: Knex, retainOldVersions = false): Promise<void> {
  for (const definition of MATERIALIZED_VIEW_DEFINITIONS) {
    if (!definition.enabled) continue;

    const { schema, name } = definition;

    console.log(`Rebuilding materialized view ${schema}.${name}...`);

    // Create new version
    const newName = `${name}_new`;
    const createSQL = buildMaterializedViewSQL({
      ...definition,
      name: newName
    });

    await knex.raw(createSQL);

    // Build indexes if defined
    if (definition.indexes) {
      for (const index of definition.indexes) {
        const indexName = index.name || `${newName}_${index.columns.join('_')}_idx`;
        const unique = index.unique ? 'UNIQUE' : '';
        const indexSQL = `CREATE ${unique} INDEX ${indexName} ON ${schema}.${newName} (${index.columns.join(', ')});`;
        await knex.raw(indexSQL);
      }
    }

    // Add comments
    const commentSQLs = buildCommentsSQL({
      ...definition,
      name: newName
    });

    for (const commentSQL of commentSQLs) {
      await knex.raw(commentSQL);
    }

    // Swap views
    if (retainOldVersions) {
      // Rename old to _old
      const oldName = `${name}_old`;
      await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${schema}.${oldName};`);
      await knex.raw(`ALTER MATERIALIZED VIEW ${schema}.${name} RENAME TO ${oldName};`);
    } else {
      // Drop old
      await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${schema}.${name};`);
    }

    // Rename new to current
    await knex.raw(`ALTER MATERIALIZED VIEW ${schema}.${newName} RENAME TO ${name};`);

    console.log(`Successfully rebuilt ${schema}.${name}`);
  }
}
