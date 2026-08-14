# BioHub Martin Gateway

Authenticating gateway that fronts the [Martin](https://martin.maplibre.org/) vector tile server.

```
MapLibre -> Martin Gateway (this service) -> Martin -> PostGIS
```

Tile response bodies never pass through the BioHub API. The API only issues short lived tile tokens;
this service verifies them locally and proxies the request to Martin.

## Why it exists

Martin has no concept of authorization: anything it publishes is readable by anyone who can reach it.
This gateway is the single public entry point for tiles and enforces four things:

1. **Authentication** — every request must carry a valid, unexpired, correctly scoped tile token.
2. **Allowlisting** — exactly one URL shape is served. Martin's catalog, TileJSON, composite sources
   and administrative endpoints are unreachable.
3. **Parameter isolation** — every client supplied query parameter is discarded. Only the trusted
   context identifier from the verified token is forwarded upstream.
4. **Cache isolation** — every response is marked `Cache-Control: no-store`, because a tile URL does
   not identify the caller and a stored copy could be replayed to another one. Server side, Martin's
   cache keys include the query string the gateway rewrites, so a tile rendered for one
   authorization context is never served to another.

Data visibility itself is enforced in SQL at tile generation time (SIMSBIOHUB-1103), not here. This
service authenticates; the database decides what a given context may see.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /martin/{source}/{z}/{x}/{y}` | The only tile route. Requires `Authorization: Bearer <tile token>`. |
| `GET /health` | Liveness/readiness. Reports on the gateway only, and never calls Martin. |

Everything else returns `404`.

### Responses

| Status | Meaning |
| --- | --- |
| `200` | Tile body, passed through from Martin with its original gzip encoding and `ETag`. |
| `204` | Valid request, no features in this tile. |
| `401` | Missing, malformed, expired, wrongly signed, or unknown-key token. The client should re-mint. |
| `403` | Valid token, but it does not grant this source or lacks the required scope. Re-minting will not help. |
| `404` | Not an allowlisted tile request, or the zoom/coordinates are out of range. |
| `429` | Rate limited (per token, or the coarse per IP backstop). |
| `502` | Martin is unavailable, failed, or answered with anything other than `200`/`204`/`404`. Normalized: no internal or database detail is exposed. |

## Configuration

All configuration is environment based and validated at startup, so a misconfigured deployment fails
immediately rather than on the first tile request.

| Variable | Default | Description |
| --- | --- | --- |
| `MARTIN_GATEWAY_PORT` | `6300` | Listen port. |
| `MARTIN_URL` | `http://127.0.0.1:3000` | Upstream Martin. Loopback in OpenShift (sidecar). |
| `MARTIN_TIMEOUT_MS` | `10000` | Upstream timeout. |
| `MARTIN_TOKEN_PUBLIC_KEY_DIR` | *(required)* | Directory of `<kid>.pem` public keys. |
| `MARTIN_TOKEN_AUD` | `biohub-tiles` | Expected `aud` claim. |
| `MARTIN_TOKEN_ISS` | `biohub-api` | Expected `iss` claim. |
| `MARTIN_TOKEN_SCOPE` | `tiles:read` | Scope the token must carry. |
| `MARTIN_ALLOWED_SOURCES` | `search` | Comma separated sources this gateway will serve. |
| `MARTIN_MIN_ZOOM` / `MARTIN_MAX_ZOOM` | `0` / `15` | Inclusive zoom bounds. |
| `MARTIN_MAX_TILE_BYTES` | `52428800` | Per-tile response size cap accepted from Martin. |
| `MARTIN_SOURCE_VERSION` | `1` | Appended to every upstream tile URL (`v=`). Martin's cache keys include the query string, so bumping this invalidates every tile Martin has cached. |
| `RATE_LIMIT_JTI_PER_MIN` | `600` | Per token budget. Must absorb a viewport pan. |
| `RATE_LIMIT_IP_PER_MIN` | `3000` | Coarse per IP backstop. |
| `ALLOWED_ORIGIN` | `*` | CORS origin. Unused in OpenShift, where tiles are same origin. |
| `METRICS_INTERVAL_SECONDS` | `300` | How often metrics are logged. |
| `LOG_LEVEL` | `info` | Log level. |

## Token verification

Tokens are RS256 and verified **locally** — the gateway never calls the API to check one, so the tile
path has no dependency on the API being up.

Only public keys are mounted here, so the gateway can verify a token but can never mint one. The
signing algorithm is pinned, which is what prevents an `alg: none` or algorithm-confusion forgery.

Keys are loaded from `MARTIN_TOKEN_PUBLIC_KEY_DIR`, one file per key id (`<kid>.pem`). Holding several
at once is what makes **rotation** possible:

1. Generate a new keypair and add its public key to the gateway secret as `<new-kid>.pem`.
2. Roll the gateway. It now accepts tokens signed by either key.
3. Point the API at the new private key and `kid`. Newly minted tokens use it; tokens already in
   flight keep working until they expire.
4. Once the old tokens have expired, remove the retired public key and roll again.

### Generating a keypair

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out 2026-07.pem
```

In OpenShift these live in two separate secrets, so the private key is never mounted into the pod
that serves public traffic:

```bash
# API only - the signing key
oc create secret generic martin-token-private --from-file=private.pem -n <namespace>

# Martin Gateway only - the verification key(s), named by kid
oc create secret generic martin-token-public --from-file=2026-07.pem -n <namespace>
```

Locally the keypair is generated automatically into a docker volume by the `martin_keys_setup` compose
service; no manual step is needed.

## Local development

```bash
make martin-gateway        # start the signing keys, Martin, and this gateway
make log-martin-gateway
```

Then, with the API running (`make web`):

```bash
# Mint a session
curl -s -X POST http://localhost:6200/api/martin/token

# Fetch a tile (404 until SIMSBIOHUB-1103 publishes the `search` source)
curl -s -H "Authorization: Bearer <token>" http://localhost:6300/martin/search/5/5/11
```

## Tests

```bash
npm test                 # unit suite
make test-martin-gateway          # integration suite, against the running compose stack
```

The unit suite covers the full verification matrix (invalid signatures, expired tokens, wrong
audience/issuer/source, missing scope, unknown key id, rotation, `alg: none`, post-signing payload
edits), allowlist rejection (catalog, TileJSON, composite sources, traversal, out-of-range
coordinates), query parameter stripping, response metadata preservation, upstream status
normalization, per-context upstream URLs, in-flight deduplication, and that the `Authorization`
header is never logged.

The integration suite runs against the real stack and additionally proves that tile bytes are
byte-for-byte identical to Martin's, and that tiles continue to serve while the API is unavailable.
