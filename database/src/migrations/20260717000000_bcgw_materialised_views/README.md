# BCGW materialised views

The adjacent `20260717000000_bcgw_materialised_views.ts` is the Knex migration entrypoint. It owns schema and role setup, the GeoJSON helper, and the `up`/`down` sequence. This directory contains that migration's supporting definitions; Knex does not discover these files as separate migrations.

| File | Responsibility |
| --- | --- |
| `views.ts` | Register the six public/all variants, their creation order, and the original rollback order. |
| `observation.ts` | Observation columns, column comments, and query shared by site-linked and incidental observations. |
| `telemetry.ts` | Telemetry columns, column comments, and query. |
| `filters.ts` | Shared effective-security and fish-taxon exclusion rules. |
| `build-view-sql.ts` | Assemble each query with its columns, security mode, and observation site filter. |
| `lifecycle.ts` | Create the temporary view, apply column comments, and replace the final view. |
| `config.ts` | BCGW schema name. |
| `types.ts` | View names, columns, comments, and site-filter types. |

Keep query expressions and their column comments together in the appropriate domain file. Both observation variants share one definition; their site filters are selected in the registry. Shared security and taxon rules apply to both domains through the SQL builder.

These files belong to this migration version. After deployment, change database behavior through a new migration and version its definitions rather than modifying helpers imported by this historical migration.

Snapshot taxonomy data is seed-specific and lives separately in `../../seeds/snapshot/taxonomy.ts`, called by `10_snapshot_features.ts`.
