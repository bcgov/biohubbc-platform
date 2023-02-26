# OpenShift Templates

## Prerequisites For Deploying On OpenShift

### Import Base Image For `crunchy-postgres-gis` Used By `db.bc.yaml`

Use the openshift CLI to import images from online registries:

- Fetch latest version

  ```
  oc import-image crunchydata/crunchy-postgres-gis:latest --from=registry.connect.redhat.com/crunchydata/crunchy-postgres-gis:latest --confirm
  ```

- Fetch specific version

  ```
  oc import-image crunchydata/crunchy-postgres-gis:ubi8-14.2-3.1-0 --from=registry.connect.redhat.com/crunchydata/crunchy-postgres-gis:ubi8-14.2-3.1-0 --confirm
  ```

Openshift documentation on importing images

- https://catalog.redhat.com/software/containers/crunchydata/crunchy-postgres-gis/595e572a1fbe9833203fa18c?tag=ubi8-14.2-3.1-0&push_date=1646862897000&container-tabs=gti

  - See `oc import-image` command
