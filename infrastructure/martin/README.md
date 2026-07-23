# biohub-platform-martin

Helm chart for [Martin](https://martin.maplibre.org/), the vector tile server that renders BioHub
map tiles directly from PostGIS.

## Request flow

```
MapLibre -> Martin Gateway (authentication) -> Martin -> PostGIS
```

Tile bytes never pass through the BioHub API. The API only issues short lived tile tokens; the tile
gateway (SIMSBIOHUB-1102) verifies them and proxies to Martin.

Until the gateway lands, Martin is deployed with an internal `ClusterIP` Service **only**. It has no
OpenShift `Route` and is reachable solely from other pods in the namespace.

## Deployment

Martin is deployed as a dependency of the `biohub-platform` umbrella chart, not as its own Helm
release. It is enabled/disabled with the `martin.enabled` flag, and environment specific values live
in the umbrella chart:

- `infrastructure/biohub-platform/values.yaml`
- `infrastructure/biohub-platform/values-pr.yaml`
- `infrastructure/biohub-platform/values-{dev,test,prod}.yaml`

## Configuration

| Value | Description |
| --- | --- |
| `image.repository` / `image.tag` / `image.pullPolicy` | Official Martin image. Keep `image.tag` in step with `MARTIN_VERSION` in `env_config/env.docker`. |
| `replicas` | Pod replica count. |
| `resources.requests` / `resources.limits` | CPU and memory. |
| `service.type` / `service.port` / `service.targetPort` | Internal service. Always `ClusterIP`. |
| `app.martin.workerProcesses` / `app.martin.poolSize` | Martin worker threads and Postgres pool size. |
| `app.martin.functions` | Explicitly published function sources. |
| `app.database.*` | Database coordinates and secrets (see below). |

Changing any Martin configuration value updates the `ConfigMap` and rolls the pods, via a
`checksum/config` annotation on the pod template.

### Source publication

Martin's automatic discovery is **always disabled** (`auto_publish: false`). Left enabled, Martin
publishes every table and function its database role can read. Only the function sources listed in
`app.martin.functions` are served.

This ticket publishes **no** sources: it deploys the tile server itself, so `app.martin.functions` is
empty and Martin serves an empty catalog. The search-result source (`biohub.martin_search`) is added by
SIMSBIOHUB-1103, which is the first ticket where a tile can actually be rendered.

### Database access

Martin connects as a dedicated least-privilege role (`martin`) that has `CONNECT`, `USAGE` on the
`biohub` schema, and `EXECUTE` on approved tile functions only. It holds **no table privileges**.

- **DEV/TEST/PROD (`useCrunchy: true`)** — the role and its password are created by the Crunchy
  Postgres Operator from the `users` block of the PostgresCluster CR, which publishes the
  `<cluster>-pguser-martin` secret. Connections use `sslmode=verify-full` against the `pgo-root-cacert`
  CA, the same one the api uses.
- **PR (`useCrunchy: false`)** — the role is created by the database migration using credentials from
  the legacy `biohub-platform-db` secret, populated from the `DATABASE_USER_MARTIN` /
  `DATABASE_USER_MARTIN_PASSWORD` GitHub secrets. Connections use `sslmode=prefer`.

Martin points at the Crunchy **primary** service, not PgBouncer: its driver uses prepared statements,
which are incompatible with PgBouncer transaction pooling. A `<cluster>-replicas` service also exists
and is a future option for keeping tile bursts off the primary.

> **Deployment ordering:** in Crunchy environments the `infrastructure/crunchy-db` chart should be
> upgraded **before** Martin is deployed to that environment, so the operator has created the `martin`
> role and its secret. If the order is reversed, database setup logs a WARNING and continues without
> the martin grants; the `02_martin_role_grants` seed re-applies them on every deploy, so the next
> platform deploy after the role exists heals it. Until then Martin cannot connect to the database.

> **Grant restore:** the TEST/PROD cutover restores with `pg_restore --no-acl`, which strips both the
> `martin` grants and the `REVOKE ... FROM PUBLIC` on the tile function. Both are re-applied by the
> re-grant block in `infrastructure/crunchy-db/templates/migration-job.yaml`, and the tile function
> seed re-applies them on every deploy.

## Local development

Martin runs in Docker Compose on the existing `biohubbc-network`:

```bash
make martin
```

It is then available on the host at `http://localhost:${MARTIN_PORT}` (default `3000`):

- `http://localhost:3000/health` — health endpoint used by the container healthcheck and the pod probes
- `http://localhost:3000/catalog` — published sources (empty until SIMSBIOHUB-1103 adds `search`)

Local configuration is defined inline in the `martin-config` entry of the top level `configs:` block in
`compose.yml`, and must be kept in step with `templates/configmap.yaml`, which renders the same
configuration for OpenShift. The relevant variables (`MARTIN_VERSION`, `MARTIN_PORT`, `DB_USER_MARTIN`,
`DB_USER_MARTIN_PASS`) are documented in `env_config/env.docker`.

## Verifying a deployment

```bash
# Martin should be reachable from another pod in the namespace...
oc rsh <api-pod> curl -s http://<martin-service>:3000/health

# ...and must NOT have a Route
oc get routes | grep martin   # expect no results
```
