# biohub-platform-martin

Helm chart for [Martin](https://martin.maplibre.org/), the vector tile server that renders BioHub
map tiles directly from PostGIS, together with the authenticating tile gateway that fronts it.

## Request flow

```
MapLibre -> tile gateway (authentication) -> Martin -> PostGIS
```

Tile bytes never pass through the BioHub API. The API only issues short lived tile tokens; the tile
gateway verifies them locally and proxies to Martin.

## Topology

The chart deploys **one pod with two containers**:

| Container | Exposure |
| --- | --- |
| `tile-gateway` | The only public entry point. Backed by the `ClusterIP` Service and the `/tiles` Route. |
| `martin` | Binds `127.0.0.1` only. No container port, no Service, no Route. |

Because Martin listens on loopback inside a shared pod, it is unreachable from anywhere else in the
cluster **by construction** rather than by policy: the only path to it is through the gateway, which
authenticates every request. That is also why Martin uses `exec` probes here — a kubelet `httpGet`
probe dials the pod IP, which Martin no longer listens on.

The gateway is exposed by a **path based Route** (`/tiles`) on the environment's app hostname, so
tile requests are same origin with the frontend and no CORS preflight occurs.

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
| `gateway.image.*` | Tile gateway image, built and pushed by the deploy workflows. |
| `gateway.allowedSources` | Sources the gateway will serve. Anything else is rejected regardless of what Martin publishes. |
| `gateway.minZoom` / `gateway.maxZoom` | Zoom bounds enforced before a request reaches Martin. |
| `gateway.cache.*` | Tile cache TTL, size cap, and the `sourceVersion` cache buster. |
| `gateway.rateLimit.*` | Per token and coarse per IP budgets. |
| `gateway.token.*` | Expected audience/issuer, and the public key secret name. |
| `route.host` / `route.path` | Public route. Leave `host` empty in PR environments to derive the per-PR app hostname. |
| `networkPolicy.enabled` | Optional ingress hardening for the gateway port. Off by default. |

Changing any Martin configuration value updates the `ConfigMap` and rolls the pods, via a
`checksum/config` annotation on the pod template.

### Source publication

Martin's automatic discovery is **always disabled** (`auto_publish: false`). Left enabled, Martin
publishes every table and function its database role can read. Only the function sources listed in
`app.martin.functions` are served.

Two sources are published:

- **`search`** (`biohub.tile_search`) — authorized search-result tiles. Resolves the opaque context id
  the gateway forwards, then applies the feature security predicate **at serve time**, so securing a
  feature removes it from tiles within one gateway cache TTL rather than lasting for the life of a
  session. This is the only source in the gateway's allowlist.
- **`fixture`** (`biohub.tile_fixture`) — a synthetic point grid used to smoke test the stack. It is
  deliberately **excluded** from `gateway.allowedSources`, so it is reachable only from inside the
  cluster.

### Database access

Martin connects as a dedicated least-privilege role (`martin`) that has `CONNECT`, `USAGE` on the
`biohub` schema, and `EXECUTE` on approved tile functions only. It holds **no table privileges**.

That works because `biohub.tile_search` is `SECURITY DEFINER` with a pinned `search_path`: it runs as
its owner (the migration role), which can read the underlying tables, so the tile SQL never needs the
martin role to be granted anything beyond executing the one function.

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

> **Deployment ordering:** in Crunchy environments the `infrastructure/crunchy-db` chart must be
> upgraded **before** Martin is deployed to that environment, so the operator has created the `martin`
> role and its secret. The database migration fails with an explicit message if the role is missing.

> **Grant restore:** the TEST/PROD cutover restores with `pg_restore --no-acl`, which strips both the
> `martin` grants and the `REVOKE ... FROM PUBLIC` on tile functions. Both are re-applied by the
> re-grant block in `infrastructure/crunchy-db/templates/migration-job.yaml`, and the tile function
> seed re-applies them on every deploy.

## Tile tokens and key rotation

Tokens are RS256. The **private** signing key is mounted only into the api pod
(`tile-token-private`); the tile gateway holds only the **public** verification keys
(`tile-token-public`, one `<kid>.pem` per accepted key). The gateway can therefore verify a token but
can never mint one, and verification is local, so the tile path does not depend on the api being up.

Both secrets are created manually per namespace, before the chart is deployed there:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out 2026-07.pem

oc create secret generic tile-token-private --from-file=private.pem -n <namespace>
oc create secret generic tile-token-public  --from-file=2026-07.pem -n <namespace>
```

PR environments share the dev namespace secrets, matching how the `keycloak` and object store secrets
are already handled.

To rotate: add the new public key alongside the old one and roll the gateway, then point the api at
the new private key and `keyId`. Tokens already in flight keep working until they expire, after which
the retired public key is removed. See `tile-gateway/README.md` for the full runbook.

## Local development

The tile stack runs in Docker Compose on the existing `biohubbc-network`:

```bash
make tiles   # signing keys, Martin, and the tile gateway
```

Locally Martin is also published on the host, which is convenient for debugging but is NOT how it is
exposed in OpenShift (where it binds loopback only):

- `http://localhost:3000/health` — health endpoint used by the container healthcheck
- `http://localhost:3000/catalog` — published sources (should list only `fixture`)
- `http://localhost:3000/fixture/{z}/{x}/{y}` — fixture vector tiles, unauthenticated

The authenticated path, which mirrors production, goes through the gateway on port `6300`:

```bash
TOKEN=$(curl -s -X POST http://localhost:6200/api/tile/token | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:6300/tiles/fixture/5/5/11 --output tile.mvt
```

Local configuration is repository managed in `env_config/martin/config.yaml` and must be kept in step
with `templates/configmap.yaml`, which renders the same configuration for OpenShift. The relevant
variables (`MARTIN_VERSION`, `MARTIN_PORT`, `DB_USER_MARTIN`, `DB_USER_MARTIN_PASS`) and the tile
gateway variables (`TILE_*`, `RATE_LIMIT_*`) are documented in `env_config/env.docker`.

## Verifying a deployment

```bash
# The gateway is reachable in the namespace and healthy
oc rsh <api-pod> curl -s http://<martin-service>:6300/health

# Martin is NOT reachable: it binds loopback and has no Service of its own
oc rsh <api-pod> curl -s --max-time 5 http://<martin-service>:3000/health   # expect failure

# Exactly one Route, on the app hostname, path /tiles
oc get route <release>-martin<suffix> -o jsonpath='{.spec.host}{.spec.path}{"\n"}'

# Tiles require a token
curl -s -o /dev/null -w '%{http_code}\n' https://<app-host>/tiles/fixture/5/5/11   # expect 401
```
