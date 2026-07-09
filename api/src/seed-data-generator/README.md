# Seed Data Generator

Run-once api-context tooling that produces the committed seed fixtures for two snapshot tiers by running
the **real ingestion pipeline** (ingest → index → closure) against source tarballs, securing a subset of
the Boreal Moose telemetry deployments, and serializing the resulting live DB rows into a uuid-keyed
fixture.

The **fixture is the seed's source of truth** — not the generator and not the source tar. The replay seed
(`database/src/seeds/10_snapshot_features.ts`) reads the fixture and rebuilds each submission with fresh ids. The generator
is only needed to regenerate the fixture (a new dataset, a pipeline-logic change, or a derived-schema
change). It is intentionally NOT wired into any build or request flow.

## Files

| File | Role |
|------|------|
| `generate.ts` | Stage tar → seed FK chain → ingest → index → closure → secure → compute anchors. Owns "what is correct". |
| `dump.ts` | Serialize a generated submission's live rows into a uuid-keyed `SnapshotFixture` with per-table counts. |
| `run.ts` | Thin entrypoint: generate + dump both tiers, write the fixtures + an `index.json`. |
| `fixtures/sampler/` | Committed sampler source (`features/`, `codes/`, `files/`). Packed into a tar at runtime — the tar is never committed (single source of truth is the JSON dir). |

## Source tarballs

- **Feature Type Sampler** — committed under `fixtures/sampler/`. Exactly one valid feature per feature
  type, so every type is proven ingestable. It is a *type* smoke check, not a search fixture: one row per
  type means no predicate can discriminate (nothing to *not* match). Expression-search coverage is the
  Boreal Moose tier's job, which carries multiple rows per type with differing values.
- **Boreal Moose** — an external single `.tar` (~8.5 MB), **not committed**, at the solution root:
  `data/1c342e48-d96b-47b2-996c-8e6aa35ef873.tar`. The dataset sits at the tar root
  (`<datasetId>/features|codes|files` + `.dataset-id`), which the parser ingests directly — no
  unwrapping. The committed fixture, not the tar, is the source of truth; the tar is only needed to
  regenerate.

  The tar is **not the raw export**: `docs/scripts/reduce-moose-tar.py` reduces it (telemetry sampled
  to 6 per deployment) and enriches it (fills sparse properties, synthesizes the 11 feature types the
  export omits, sets the two boolean properties) so the snapshot exercises expression search. The raw
  export is kept beside it as `*.orig.tar`, and the script always rebuilds from that backup — so it is
  idempotent and the reduction is never applied twice.

## Environment prerequisites

- The full stack must be up: **DB + MinIO + queue** (the queue is only used to enqueue an inert
  anchor-compute job; the generator computes anchors synchronously itself).
- **Migrations must be current.** The Moose dataset carries `mortality.is_confirmed` and
  `capture.is_recapture`, defined by `20260709130000_boolean_feature_properties`. Without that
  migration the indexer resolves no Blueprint assignment for them and silently drops both values,
  producing a fixture whose `property_boolean` count is `0`.
- **ITIS taxa must be present.** The indexer resolves each `taxon_id` against the `taxon` table and
  fail-fasts the whole submission's property indexing if any TSN is unresolved. A clean local DB has an
  empty `taxon` table (no ITIS sync has run), so the taxa the datasets reference must be seeded first,
  e.g.:

  ```sql
  SET search_path TO biohub, public;
  INSERT INTO taxon (itis_tsn, itis_scientific_name, common_name, itis_data, itis_update_date, create_user)
  VALUES
    (180702, 'Alces alces',                 'Moose',            '{"tsn":"180702"}'::jsonb, now(), 1),
    (180703, 'Alces americanus',            'American Moose',   '{"tsn":"180703"}'::jsonb, now(), 1),
    (177925, 'Cervidae',                    'Deer Family',      '{"tsn":"177925"}'::jsonb, now(), 1),
    (625197, 'Rangifer tarandus caribou',   'Woodland Caribou', '{"tsn":"625197"}'::jsonb, now(), 1)
  ON CONFLICT DO NOTHING;
  ```

- **Security-scope anchors** depend on a policy/scope whose URN targets the snapshot submission (owned by
  the `07_*` config seed). Until `07` retargets its scope to the snapshot, the synchronous anchor compute
  finds no matching scope and the dumped `anchors` count is `0`. The generator's compute logic and the
  dump's anchor SQL are both correct — they have nothing to anchor against in isolation.

## Rerun loop

Run from `biohubbc-platform/`. Only `./api` is bind-mounted into the api container, so the external tar
is staged into the api tree and the produced fixtures are copied back out to the committed location.

```bash
# 1. Stack up (db + minio + queue) and seed the required ITIS taxa (see prerequisites above).

# 2. Stage the Moose tar into the bind-mounted api tree. Its dataset sits at the tar root
#    (<datasetId>/features|codes|files), which the parser ingests directly — no unwrapping.
cp data/1c342e48-d96b-47b2-996c-8e6aa35ef873.tar biohubbc-platform/api/src/seed-data-generator/moose.tar

# 3. Generate + dump both tiers (writes to api/src/seed-data-generator/output/).
cd biohubbc-platform
docker compose exec api npx tsx src/seed-data-generator/run.ts

# 4. Copy the refreshed fixtures to the committed location.
cp api/src/seed-data-generator/output/*.json database/src/seeds/fixtures/seed-features/

# 5. Remove the staged tar + output dir (never commit the tar — ~8.5 MB binary).
rm -f api/src/seed-data-generator/moose.tar
rm -rf api/src/seed-data-generator/output

# 6. Commit the refreshed fixtures under database/src/seeds/fixtures/seed-features/.
```

Verify a regenerated fixture by replaying it with `make db-setup` (migrations + seeding).
`10_snapshot_features.ts` asserts every per-table row count and fails loudly on a shortfall, so a clean
seed run is the real gate. The replay is a no-op when the snapshot submission is already present, so
retire the prior one first:

```sql
SET search_path TO biohub, public;
UPDATE submission SET record_end_date = now()
WHERE description = '__seed-snapshot__' AND record_end_date IS NULL;
```

**Expect a large diff on every regeneration, even with an unchanged tar.** `submission_feature.uuid` is
minted by `gen_random_uuid()` at ingest rather than derived from the source `id`, so all uuids rotate on
each run and cascade into `parent_uuid`, the closure edges, and every property row. The stable field to
diff on is `source_id`; a big diff does not imply a big change. Only the `counts` block and the
`source_id` set are worth reviewing by eye.

## Known gaps

Each of these is a real limitation of the current dump/replay contract, not a bug in a specific run. They
are listed with what a fix would require, so a regeneration that reports a surprising `0` is not mistaken
for a broken run.

| Gap | Symptom | What a fix needs |
|-----|---------|------------------|
| **Artifact links are not replayed.** Since `20260629120000_submission_feature_property_artifact`, the pipeline writes feature→file links to `submission_feature_property_artifact`. `dump.ts` and the replay seed only know the older `submission_feature_artifact` table. | The dumped `artifact` count is `0` for both tiers (it was `1` before that migration). The `report.pdf` and `Moose_Walklines.zip` links are absent from seeded data. | A `property_artifact` section in `SnapshotFixture`, keyed by the artifact's `object_key` (its stable natural key), plus the matching insert + count assertion in `10_snapshot_features.ts`. |
| **`taxon` properties are not replayed.** The `taxon` FK is the `taxon` table's surrogate PK, which is not stable across environments. | `property_taxon` is dumped empty; the replay asserts it at `0`. The taxon-typed properties (`survey.focal_species`, `habitat_feature.associated_species`) cannot be exercised by expression predicates from seed data. Note that `animal.taxon_id` and `species_observation.taxon_id` are `number`-typed, not `taxon`-typed, so those *are* replayed. | Dump `itis_tsn` (the stable natural key) instead of `taxon_id`, and seed the referenced taxa into `taxon` before the replay resolves them back. |
| **`code` properties are not replayed.** `contributor_codeset_code_id` is a per-upload surrogate id. | `property_code` is dumped empty; the replay asserts it at `0`. `code`-typed predicates (`survey.collected_data`, `sample_technique.attractant`, `sample_period.method_technique`) cannot be exercised. | Dump the codeset name + code value as a composite natural key, and re-resolve it against the replayed contributor's codeset. |
| **`feature`-reference properties are unexercised.** No source dataset uses one. | `property_feature` is always `0`. The dump and replay both support it; there is simply nothing to dump. | A source feature carrying a feature-reference property. |

The `0` counts above are asserted by the replay seed on purpose: they are a guard that fails loudly if a
future dump reintroduces rows the seed cannot rebuild.
