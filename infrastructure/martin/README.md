# biohub-platform-martin

Helm chart for [Martin](https://martin.maplibre.org/), the vector tile server that renders BioHub
map tiles directly from PostGIS, together with the authenticating Martin Gateway that fronts it.

## Request flow

```
MapLibre -> Martin Gateway (authentication) -> Martin -> PostGIS
```

Tile bytes never pass through the BioHub API. The API only issues short lived tile tokens; the tile
gateway verifies them locally and proxies to Martin.

## Topology

The chart deploys **one pod with two containers**:

| Container | Exposure |
| --- | --- |
| `martin-gateway` | The only public entry point. Backed by the `ClusterIP` Service and the `/martin` Route. |
| `martin` | Binds `127.0.0.1` only. No container port, no Service, no Route. |

Because Martin listens on loopback inside a shared pod, it is unreachable from anywhere else in the
cluster **by construction** rather than by policy: the only path to it is through the gateway, which
authenticates every request. That is also why Martin uses `exec` probes here — a kubelet `httpGet`
probe dials the pod IP, which Martin no longer listens on.

The gateway is exposed by a **path based Route** (`/martin`) on the environment's app hostname, so
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
| `app.martin.cacheExpiry` | Lifetime of Martin's built-in tile cache entries (see below). |
| `app.martin.functions` | Explicitly published function sources. |
| `app.database.*` | Database coordinates and secrets (see below). |
| `gateway.image.*` | Martin Gateway image, built and pushed by the deploy workflows. |
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

One source is published:

- **`search`** (`biohub.martin_search`) — authorized search-result tiles. Resolves the opaque context id
  the gateway forwards, then applies the feature security predicate **at serve time**, so securing a
  feature removes it from tiles within one gateway cache TTL rather than lasting for the life of a
  session.

### Tile cache

Martin's built-in tile cache (enabled by default, 512 MB) is the **only** tile cache in the stack: the
gateway in front of it deliberately adds none. Cache keys include the full request query string, so the
trusted `context` parameter the gateway injects partitions the cache per authorization context and
entries can never leak between contexts.

By default Martin evicts entries only under size pressure. Because tiles are security filtered at
render time, that would let a newly secured feature keep appearing in already-cached tiles
indefinitely — so both configs set `cache.expiry` (`app.martin.cacheExpiry`, default `5m`), which is
the upper bound on that takedown window.

### Database access

Martin connects as a dedicated least-privilege role (`martin`) that has `CONNECT`, `USAGE` on the
`biohub` schema, and `EXECUTE` on approved tile functions only. It holds **no table privileges**.

That works because `biohub.martin_search` is `SECURITY DEFINER` with a pinned `search_path`: it runs as
its owner (the migration role), which can read the underlying tables, so the tile SQL never needs the
martin role to be granted anything beyond executing the one function.

- **DEV/TEST/PROD (`useCrunchy: true`)** — the role and its password are created by the Crunchy
  Postgres Operator from the `users` block of the PostgresCluster CR, which publishes the
  `<cluster>-pguser-martin` secret. Martin's `DATABASE_URL` consumes that secret's `uri` key — the
  operator-assembled connection URI, whose userinfo the operator percent-encodes — so no
  hand-assembly of credentials happens and reserved characters in the generated password can never
  produce an invalid connection string (the CR additionally pins the password to `AlphaNumeric`).
  Connections use `sslmode=verify-full` against the `pgo-root-cacert` CA, the same one the api uses.
- **PR (`useCrunchy: false`)** — the role is created by the database migration using credentials from
  the legacy `biohub-platform-db` secret, populated from the `DATABASE_USER_MARTIN` /
  `DATABASE_USER_MARTIN_PASSWORD` GitHub secrets. Here `DATABASE_URL` **is** assembled from the
  user/password keys with no encoding, so those project-controlled values must stay URL-safe (the
  secret template documents this). Connections use `sslmode=prefer`.

Martin points at the Crunchy **primary** service, not PgBouncer: its driver uses prepared statements,
which are incompatible with PgBouncer transaction pooling. A `<cluster>-replicas` service also exists
and is a future option for keeping tile bursts off the primary.

> **Deployment ordering:** in Crunchy environments the `infrastructure/crunchy-db` chart should be
> upgraded **before** Martin is deployed to that environment, so the operator has created the `martin`
> role and its secret. If the order is reversed, database setup logs a WARNING and continues without
> the martin grants; the `02_martin_role_grants` seed re-applies them on every deploy, so the next
> platform deploy after the role exists heals it. Until then Martin cannot connect to the database.

> **Grant restore:** the TEST/PROD cutover restores with `pg_restore --no-acl`, which strips both the
> `martin` grants and the `REVOKE ... FROM PUBLIC` on tile functions. Both are re-applied by the
> re-grant block in `infrastructure/crunchy-db/templates/migration-job.yaml`, and the tile function
> seed re-applies them on every deploy.

## Tile tokens and key rotation

Tokens are RS256. The **private** signing key is mounted only into the api pod
(`martin-token-private`); the Martin Gateway holds only the **public** verification keys
(`martin-token-public`, one `<kid>.pem` per accepted key). The gateway can therefore verify a token but
can never mint one, and verification is local, so the tile path does not depend on the api being up.

Both secrets are created manually per namespace, before the chart is deployed there:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out 2026-07.pem

oc create secret generic martin-token-private --from-file=private.pem -n <namespace>
oc create secret generic martin-token-public  --from-file=2026-07.pem -n <namespace>
```

PR environments share the dev namespace secrets, matching how the `keycloak` and object store secrets
are already handled.

Token minting in the api is **off by default** (`app.martin.enabled: false` in
`infrastructure/api/values.yaml`): enabling it mounts the `martin-token-private` secret, so an
environment must not opt in before its secret exists. After creating the secrets in a namespace, turn
minting on for that environment under the `biohub-platform-api:` section of the umbrella chart's
`values-{dev,test,prod,pr}.yaml` (`app.martin.enabled: true`).

The public key **file name is the key id**: the gateway loads `<kid>.pem` from the mounted secret and
asserts at startup that the kid the api signs with is among them, refusing to boot on a mismatch
rather than silently 401ing every tile.

Both sides read that kid from **one value**, `global.martin.keyId` in the umbrella chart's
`values.yaml` — the api to sign with, the gateway to verify against — so they cannot drift. The
chart-local `app.martin.keyId` (api) and `gateway.token.expectedKeyId` (this chart) are fallbacks for
rendering either chart standalone; do not set them per environment.

To rotate: add the new public key alongside the old one and roll the gateway, then point the api at
the new private key and change `global.martin.keyId`. Tokens already in flight keep working until
they expire, after which the retired public key is removed. See `martin-gateway/README.md` for the
full runbook.

## Local development

The Martin stack runs in Docker Compose on the existing `biohubbc-network`:

```bash
make martin-gateway   # signing keys, Martin, and the Martin Gateway
```

Locally Martin is also published on the host, which is convenient for debugging but is NOT how it is
exposed in OpenShift (where it binds loopback only):

- `http://localhost:3000/health` — health endpoint used by the container healthcheck
- `http://localhost:3000/catalog` — published sources (empty until SIMSBIOHUB-1103 adds `search`)

The authenticated path, which mirrors production, goes through the gateway on port `6300`. Martin
publishes no sources until SIMSBIOHUB-1103 adds `search`, so what can be exercised here is the token
and rejection behaviour rather than a rendered tile:

```bash
TOKEN=$(curl -s -X POST http://localhost:6200/api/martin/token | jq -r .token)

# 401: no token
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:6300/martin/search/5/5/11
# 404: authenticated, but no source is published yet
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  http://localhost:6300/martin/search/5/5/11
```

Local configuration is defined inline in the `martin-config` entry of the top level `configs:` block
in `compose.yml`, and must be kept in step with `templates/configmap.yaml`, which renders the same
configuration for OpenShift. The relevant variables (`MARTIN_VERSION`, `MARTIN_PORT`, `DB_USER_MARTIN`,
`DB_USER_MARTIN_PASS`) and the Martin Gateway variables (`MARTIN_*`, `RATE_LIMIT_*`) are documented in
`env_config/env.docker`.

## Verifying a deployment

```bash
# The gateway is reachable in the namespace and healthy
oc rsh <api-pod> curl -s http://<martin-service>:6300/health

# Martin is NOT reachable: it binds loopback and has no Service of its own
oc rsh <api-pod> curl -s --max-time 5 http://<martin-service>:3000/health   # expect failure

# Exactly one Route, on the app hostname, path /martin
oc get route <release>-martin<suffix> -o jsonpath='{.spec.host}{.spec.path}{"\n"}'

# Tiles require a token
curl -s -o /dev/null -w '%{http_code}\n' https://<app-host>/martin/search/5/5/11   # expect 401
```
