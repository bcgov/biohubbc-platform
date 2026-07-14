# ClamAV Helm Chart

This chart deploys a standalone ClamAV service for static environments (DEV/TEST/PROD), similar to the separate CrunchyDB deployment model.

## Deploy

Run from the repository root:

```sh
helm upgrade --install clamav ./infrastructure/clamav \
  -n a0ec71-dev \
  -f ./infrastructure/clamav/values.yaml \
  -f ./infrastructure/clamav/values-dev.yaml
```

```sh
helm upgrade --install clamav ./infrastructure/clamav \
  -n a0ec71-test \
  -f ./infrastructure/clamav/values.yaml \
  -f ./infrastructure/clamav/values-test.yaml
```

```sh
helm upgrade --install clamav ./infrastructure/clamav \
  -n a0ec71-prod \
  -f ./infrastructure/clamav/values.yaml \
  -f ./infrastructure/clamav/values-prod.yaml
```

## Configuration model

- `clamd.conf` is rendered from `values.clamd.*` into a ConfigMap.
- `freshclam.conf` is rendered from `values.freshclam.*` into the same ConfigMap.
- Pod restarts are automatically triggered on config changes via `checksum/config`.
- The Service is named `clamav` (port `3310`) to preserve existing API/queue consumer settings.
- The PVC uses `ReadWriteMany` (`netapp-file-standard` is NFS-backed) so rolling updates attach cleanly without Multi-Attach errors.

## Cutover and cleanup

After the Helm-managed release is healthy in each static namespace:

1. Remove the legacy `Deployment/clamav` and `Service/clamav` objects that were previously created manually.
2. Remove the legacy `ImageStream/clamav` and `BuildConfig/clamav-build` in the `-tools` namespace.
3. Keep PR environments pointed at the shared static-environment `clamav` Service (no PR-specific ClamAV deployment).
