# BioHub BC Umbrella Chart

This is an umbrella Helm chart that deploys all BioHub BC components together in the correct order:

1. **app** - React frontend application
2. **database** - PostgreSQL database with PostGIS
3. **database-setup** - Database initialization and migration job (runs after database)
4. **api** - Node.js API server (runs after database-setup)
5. **queue** - Background job worker (runs after database-setup)
6. **martin** - Vector tile server, serving map tiles directly from PostGIS (runs after database-setup)

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
- Exposed by an internal **`ClusterIP` Service only**. Martin has **no OpenShift `Route`** and is
  reachable only from other pods in the namespace.
- Automatic publication of PostgreSQL tables and functions is disabled. Only explicitly configured
  function sources are served — currently a synthetic `fixture` source used to validate the stack.
- Connects as a dedicated least-privilege `martin` role with no table privileges.

Configurable via `biohub-platform-martin` values: image repository/tag/pullPolicy, replica count,
CPU and memory requests and limits, service port, and the Martin configuration itself
(`app.martin.*`). Changing the Martin configuration rolls the pods through a `checksum/config`
annotation. See [`infrastructure/martin/README.md`](../martin/README.md) for the full reference.

> **Ordering:** in DEV/TEST/PROD the `infrastructure/crunchy-db` chart must be upgraded **before**
> Martin is deployed to that environment, so the Postgres Operator has created the `martin` role and
> its `<cluster>-pguser-martin` secret.

### Local development

Martin runs in Docker Compose alongside the other local services:

```bash
make martin
```

It is then available on the host at `http://localhost:3000` (configurable through `MARTIN_PORT` in
`.env`):

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/health` | Health endpoint used by the container healthcheck and pod probes |
| `http://localhost:3000/catalog` | Published sources (should list only `fixture`) |
| `http://localhost:3000/fixture/{z}/{x}/{y}` | Fixture vector tiles |

Required local variables are documented in `env_config/env.docker`: `MARTIN_VERSION`, `MARTIN_PORT`,
`DB_USER_MARTIN`, and `DB_USER_MARTIN_PASS`. Local Martin configuration is repository managed in
`env_config/martin/config.yaml`, and uses the same source-publication policy and a compatible image
version to the deployed configuration. Environment specific differences (host port exposure,
resources, TLS mode, and the database role source) are explicit in `.env` and the values files.
