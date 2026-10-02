# BCGW verification

## Organization

The three migrations own their mappings, SQL generation and domain SQL:

- Infrastructure creates `bcgw`, the private `bcgw_internal` schema, and the reader role. Default reader grants apply only to `bcgw`.
- Observations defines `bcgw_internal.observation_export_rows` once, then four materialized exports filtered by `has_sample_site` and `is_secured`.
- Telemetry defines `bcgw_internal.telemetry_export_rows` once, then two materialized exports filtered by `is_secured`.

Each domain migration starts with feature-type and property mappings. Fixed property IDs, label columns (string or code), and numeric projections are generated locally from those mappings. Relationship selection, geometry/timestamp fallbacks, taxonomy and security remain explicit SQL. Migration-local export mappings define the ordered column contract, comments and filters, and also drive rollback order. Domain mappings and projection builders remain migration-local. Generic SQL quoting helpers are shared through `src/utils/migrations.ts`.

The internal sources are ordinary views. Each materialized export refreshes from current base data independently; there is no snapshot refresh ordering requirement. Refreshing multiple exports in one transaction provides a common transaction timestamp. Future definition changes belong in new migrations. Rollback drops exports before source views, then removes the schemas and reader role without cascading over unexpected objects.

## Running checks

From `database`:

```sh
npm run test:bcgw
npm run test:bcgw -- --plans
npm run test:bcgw -- --legacy
```

Requires installed database dependencies, Docker and a local PostGIS container. Set
`BCGW_TEST_CONTAINER` to override `biohub-db-all-container`. Each run creates and
drops a disposable database; application databases and migration history are untouched.

The normal suite needs no Git history:

| File | Purpose |
| --- | --- |
| `schema.sql` | Minimal tables and indexes required by the query contract; unrelated application triggers are omitted |
| `fixtures.sql` | Direct typed-property, taxonomy and closure fixtures; ingestion JSON starts empty |
| `contract.json` | Expected ordered columns, types and comments for each export family |
| `assertions.sql` | Domain behavior: security, taxonomy, relationships, geometry and cutoff boundaries |
| `property-assertions.sql` | Metadata, multivalued properties, partial timestamps and closure membership changes |
| `structure-assertions.sql` | Export partitions, public subsets and refresh independence |
| `scale.sql` | Optional 2,000 observations and 1,000 telemetry fixes |
| `verify.cjs` | Migration discovery/execution, contract and access checks, rollback/replay, optional plans |
| `legacy/` | Optional frozen historical oracle, JSON fixtures and conversion adapter |

The suite checks six materialized exports, two private ordinary sources, reader access
only to exports, one row per feature, exact column contracts, JSON independence,
setup/rollback/replay and preservation of the unrelated GeoJSON helper.

`--plans` captures EXPLAIN ANALYZE/BUFFERS from definitions read through PostgreSQL's
`pg_matviews` catalog. It does not parse migration source text. Plans are written to
`BCGW_PLAN_OUTPUT` or the temporary directory. Synthetic fixture timings are regression
signals, not production refresh guarantees.

`--legacy` additionally requires Git commit `aaa21bb8f945843783f85184d5ece8e476618bc2`.
It verifies frozen query hashes and compares single-valued exports in both directions
using EXCEPT ALL. Four fixture IDs with intentionally different taxonomy behavior
are excluded from that comparison and covered by domain assertions. The historical
multirow contract differs from the current one-row-per-feature contract.

## Query semantics

- Every participating domain feature must occur as a closure source. Closure includes drafts, so publication dates, active windows and active feature types are checked separately.
- Closure ancestry alone propagates security; feature references do not. Missing self-links fail closed for public exports while remaining flagged in all exports.
- Properties come from normalized typed tables and active metadata. Missing metadata produces NULL; ambiguous fixed assignments raise an error. Code labels require active codes and codesets.
- Independent multivalued properties are aggregated separately in property-row order. Repeated equal values are retained. Taxon exclusions apply per value; missing active taxon lookups have no JSON fallback.
- Site selection prefers usable geometry, then ancestry and feature ID. A site without geometry still establishes membership. Period selection prefers ancestry and feature ID; property IDs break ties.
- Observation location precedence is coordinates, own geometry, then selected site. Timestamp fallback applies only when no observation timestamp row exists; partial timestamps remain partial.
- Telemetry uses stored local date/time components and a three-calendar-month cutoff. Date-only timestamps use midnight; time-only timestamps cannot satisfy the cutoff. Original ingestion timezone offsets cannot be recovered.
- Ecological units retain the direct content/parent relationships used by the export. Closure is not a substitute for these relationships: its evidence graph excludes content edges.

## Configurable properties and export contracts

Property names are resolved against active metadata each time the source query runs.
Retiring or renaming an optional property such as `life_stage` leaves that export column
NULL after refresh; it does not remove a physical SQL column or invalidate the query.
Until refresh, a materialized export still contains its previous values. Regression
checks cover both retirement and renaming.

These mappings are migration-time configuration. New metadata properties do not
add export columns automatically. Runtime-configurable output would require a separate
export contract/query layer, or a representation such as one row per property. Replacing
materialized views with ordinary views would change freshness and query cost, while
retaining this fixed column contract.
