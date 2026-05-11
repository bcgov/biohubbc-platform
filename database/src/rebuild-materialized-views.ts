#!/usr/bin/env node

/**
 * Rebuild Materialized Views Script
 *
 * This script rebuilds all enabled materialized views from the current configuration.
 * Run this after making changes to the materialized view definitions.
 *
 * Usage: npm run rebuild-mvs [-- --retain-old]
 */

import { knex } from './knexfile';
import { rebuildMaterializedViews } from './materialized-views';

async function main() {
  const retainOld = process.argv.includes('--retain-old');

  try {
    console.log('Starting materialized view rebuild...');
    await rebuildMaterializedViews(knex, retainOld);
    console.log('Materialized view rebuild completed successfully.');
  } catch (error) {
    console.error('Error rebuilding materialized views:', error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

main();
