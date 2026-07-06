# Seed Data Generator

Run-once api-context tooling that produces the committed seed fixtures for two snapshot tiers by running
the **real ingestion pipeline** (ingest → index → closure) against source tarballs, securing a subset of
the Boreal Moose telemetry deployments, and serializing the resulting live DB rows into a uuid-keyed
fixture.

The **fixture is the seed's source of truth** — not the generator and not the source tar. The replay seed
(`database/src/seeds/09_*`) reads the fixture and rebuilds each submission with fresh ids. The generator
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

- **Feature Type Sampler** — committed under `fixtures/sampler/`. One valid feature per feature type the
  Boreal Moose export does not cover, so the snapshot exercises every feature type.
- **Boreal Moose** — an external `.tar` (~7.5 MB), **not committed**. It lives at the solution root under
  `data/1c342e48-d96b-47b2-996c-8e6aa35ef873.tar`. **It is double-wrapped**: the outer tar contains a
  single inner `.tar`, which is the real SIMS dataset (`<datasetId>/features/*.json` + `.dataset-id`).
  Unwrap one layer before staging it (see the rerun loop). The committed fixture, not the tar, is the
  source of truth — the tar is only needed to regenerate.

## Environment prerequisites

- The full stack must be up: **DB + MinIO + queue** (the queue is only used to enqueue an inert
  anchor-compute job; the generator computes anchors synchronously itself).
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

# 2. Unwrap the double-wrapped Moose tar and stage it into the bind-mounted api tree.
tar -xOf data/1c342e48-d96b-47b2-996c-8e6aa35ef873.tar > /tmp/moose.tar     # one layer off
cp /tmp/moose.tar biohubbc-platform/api/src/seed-data-generator/moose.tar

# 3. Generate + dump both tiers (writes to api/src/seed-data-generator/output/).
cd biohubbc-platform
docker compose exec api npx tsx src/seed-data-generator/run.ts

# 4. Copy the refreshed fixtures to the committed location.
cp api/src/seed-data-generator/output/*.json database/src/seeds/fixtures/seed-features/

# 5. Remove the staged tar + output dir (never commit the tar — 7.5 MB binary).
rm -f api/src/seed-data-generator/moose.tar
rm -rf api/src/seed-data-generator/output

# 6. Commit the refreshed fixtures under database/src/seeds/fixtures/seed-features/.
```

The Moose tar path can also be passed as the first argument:
`docker compose exec api npx tsx src/seed-data-generator/run.ts <mooseTarPath>`. The output directory can
be overridden with the `SEED_FIXTURE_OUTPUT_DIR` env var.
