# BioHub BC Umbrella Chart

This is an umbrella Helm chart that deploys all BioHub BC components together in the correct order:

1. **app** - React frontend application
2. **database** - PostgreSQL database with PostGIS
3. **database-setup** - Database initialization and migration job (runs after database)
4. **api** - Node.js API server (runs after database-setup)
5. **queue** - Background job worker (runs after database-setup)
6. **martin** - Vector tile server plus its authenticating tile gateway, serving map tiles directly from PostGIS (runs after database-setup)

## Usage

### Install the umbrella chart

```bash
# For development
helm install biohub-platform ./biohub-platform -f values-dev.yaml

# For test
helm install biohub-platform ./biohub-platform -f values-test.yaml

# For production
helm install biohub-platform ./biohub-platform -f values-prod.yaml

# For PR environment
helm install biohub-platform ./biohub-platform -f values-pr.yaml
```

### Update dependencies

Before deploying, make sure to update the chart dependencies:

```bash
helm dependency update ./biohub-platform
```

### Upgrade existing deployment

```bash
helm upgrade biohub-platform ./biohub-platform -f values-dev.yaml
```

## Component Configuration

Each component can be enabled/disabled by setting the appropriate flag in the values file:

```yaml
app:
  enabled: true

database:
  enabled: true

database-setup:
  enabled: true

api:
  enabled: true

queue:
  enabled: true

martin:
  enabled: true
```

When `martin.enabled` is `false`, no Martin resources are rendered.

## Values Files

- `values.yaml` - Default values
- `values-dev.yaml` - Development environment
- `values-test.yaml` - Test environment
- `values-prod.yaml` - Production environment
- `values-pr.yaml` - PR environment

## Individual Chart Values

Component-specific values are passed through to the individual charts. Each component section in the values file corresponds to the values for that specific chart.

For example, to configure the database component:

```yaml
database:
  enabled: true
  environment:
    name: dev
    id: deploy
  app:
    nodeEnv: development
  replicas: 1
  resources:
    requests:
      cpu: 50m
      memory: 100Mi
    limits:
      cpu: 600m
      memory: 4Gi
  persistence:
    size: 3Gi
```

## Martin (vector tiles)

Martin serves map vector tiles directly from PostGIS. The intended request flow is:

```
MapLibre → authenticated tile gateway → Martin → PostGIS
```

Tile response bodies never pass through the Node API. The API only issues short lived tile tokens;
the tile gateway (SIMSBIOHUB-1102) verifies them and proxies the request to Martin.

### OpenShift

- Deployed through this umbrella chart (not as a separate Helm release), gated by `martin.enabled`.
- **One pod, two containers.** The `tile-gateway` container is the only public entry point; `martin`
  binds `127.0.0.1` and has no container port, no Service, and no `Route`, so it is unreachable from
  elsewhere in the cluster by construction.
- The gateway is exposed by a **path based `Route` on the app's own hostname** (`/tiles`), so tile
  requests are same origin with the frontend and need no CORS handling.
- Automatic publication of PostgreSQL tables and functions is disabled. Only explicitly configured
  function sources are served — currently a synthetic `fixture` source used to validate the stack.
- Connects as a dedicated least-privilege `martin` role with no table privileges.
- Tile tokens are RS256. The api mounts the **private** signing key (`tile-token-private`); the
  gateway mounts only the **public** verification keys (`tile-token-public`). Both secrets are created
  manually per namespace before deploying — see [`infrastructure/martin/README.md`](../martin/README.md).

Configurable via `biohub-platform-martin` values: image repository/tag/pullPolicy, replica count,
CPU and memory requests and limits, service port, and the Martin configuration itself
(`app.martin.*`). Changing the Martin configuration rolls the pods through a `checksum/config`
annotation. See [`infrastructure/martin/README.md`](../martin/README.md) for the full reference.

> **Ordering:** in DEV/TEST/PROD the `infrastructure/crunchy-db` chart must be upgraded **before**
> Martin is deployed to that environment, so the Postgres Operator has created the `martin` role and
> its `<cluster>-pguser-martin` secret.

### Local development

The tile stack runs in Docker Compose alongside the other local services:

```bash
make tiles
```

That starts the signing keypair generator, Martin, and the tile gateway:

| URL | Purpose |
| --- | --- |
| `http://localhost:6300/health` | Tile gateway health, used by the pod probes |
| `http://localhost:6300/tiles/{source}/{z}/{x}/{y}` | Authenticated tiles (requires a Bearer tile token) |
| `http://localhost:3000/catalog` | Martin's published sources (local only; should list just `fixture`) |

Mint a token from the api, then fetch a tile:

```bash
TOKEN=$(curl -s -X POST http://localhost:6200/api/tile/token | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:6300/tiles/fixture/5/5/11 --output tile.mvt
```

Unlike OpenShift, Martin's own port is published locally to make debugging easier.

Required local variables are documented in `env_config/env.docker`: `MARTIN_VERSION`, `MARTIN_PORT`,
`DB_USER_MARTIN`, `DB_USER_MARTIN_PASS`, and the tile gateway's `TILE_*` / `RATE_LIMIT_*` settings. Local Martin configuration is repository managed in
`env_config/martin/config.yaml`, and uses the same source-publication policy and a compatible image
version to the deployed configuration. Environment specific differences (host port exposure,
resources, TLS mode, and the database role source) are explicit in `.env` and the values files.
