# Moving BioHub to Postgres 18 (SIMSBIOHUB-1203, SIMSBIOHUB-1204)

Each environment moves from its Postgres 17.7 / PostGIS 3.5 Crunchy cluster to a new Postgres 18 / PostGIS 3.6
cluster that also carries the `roaringbitmap` extension. Crunchy's in-place upgrade (`PGUpgrade`) does not
support PostGIS clusters, so the data is copied with a dump and restore by `templates/migration-job.yaml`, and
the old cluster stays untouched as the fallback until it is retired.

## The merge is the switch

Static deploys run when a PR merges, and this change sets `values-dev.yaml`, `values-test.yaml` and
`values-prod.yaml` at once. The deploy that ships an environment's values is what moves its apps onto the new
cluster, and it also runs the migration that creates `roaringbitmap`, which fails against a Postgres 17 cluster.

| Environment | The switch | Steps A and B must be done before it |
| --- | --- | --- |
| DEV | merging the SIMSBIOHUB-1203 PR into `dev` | yes |
| TEST | the next "Release dev to test" | yes |
| PROD | the next "Release test to prod" | yes |

So once the PR is in `dev`, **no release goes to TEST or PROD until that environment's new cluster has been
migrated**, and that release is merged during the environment's window. Announce the release freeze when the PR
merges.

Order: BioHub DEV, SIMS DEV, BioHub TEST, SIMS TEST, BioHub PROD, SIMS PROD. Time the dump and restore in TEST
to plan the PROD windows. SIMS publishes to BioHub, so SIMS submissions to BioHub fail during a BioHub window.

## Names

| | DEV | TEST | PROD |
| --- | --- | --- | --- |
| Namespace (`NS`) | `a0ec71-dev` | `a0ec71-test` | `a0ec71-prod` |
| Old cluster (`OLD`) | `biohub-platform-db-dev` | `biohub-platform-db-test` | `biohub-platform-db-prod` |
| New cluster and Helm release (`NEW`) | `biohub-platform-db-dev-pg18` | `biohub-platform-db-test-pg18` | `biohub-platform-db-prod-pg18` |

Each cluster's database is named after the cluster. Workloads to freeze, in every environment:
`biohub-platform-{api,queue,app,martin}-<env>-deploy`. The migration job is `biohub-platform-db-migration`.

Set these in the shell before each environment (DEV shown):

```bash
ENV=dev
NS=a0ec71-$ENV
OLD=biohub-platform-db-$ENV
NEW=$OLD-pg18
oc project $NS
```

`primary` below is a helper for the primary pod of a cluster:

```bash
primary() { oc get pod -l postgres-operator.crunchydata.com/cluster=$1,postgres-operator.crunchydata.com/role=master -o name; }
```

## 0. Once, before DEV: the Postgres image

The Crunchy image has no `roaringbitmap`, so the clusters run an image built from `image/Dockerfile`.

1. Create an Artifactory service account for GitHub in the tools namespace, so it can be revoked without
   touching the one the cluster uses (`oc get artsvcacct -n a0ec71-tools` lists the existing ones). Copy its
   `username` and `password` from the `artifacts-<name>-*` secret into the repository secrets
   `ARTIFACTORY_USERNAME` and `ARTIFACTORY_PASSWORD`.
2. Run **Build Postgres Image** (`workflow_dispatch`) on the PR branch, then confirm the tag:
   `oc get istag biohub-platform-crunchy-postgres:18.1-3.6-rb1.3.0 -n a0ec71-tools`.
3. Confirm the environments can pull from tools: `oc get rolebinding -n a0ec71-tools -o wide | grep image-puller`
   should list `system:serviceaccounts:a0ec71-dev`, `-test` and `-prod`. That group includes the
   `<cluster>-instance` service account the Postgres pods run as.

## A. Prepare (any time before the window)

1. **Size and quota.** Check the database's size and the quota left:
   ```bash
   oc exec $(primary $OLD) -c database -- psql -d $OLD -Atc "SELECT pg_size_pretty(pg_database_size(current_database()))"
   oc get resourcequota,pvc
   ```
   The new cluster requests 5Gi volumes (`values-$ENV.yaml`): one in DEV, two in TEST and PROD. The namespace
   quota is 32Gi. In DEV, confirm 5Gi is free; in TEST and PROD, confirm 10Gi will be free once step A5 has
   released one of the old cluster's volumes. Raise the request before step A6 if the database is over 2Gi.
2. **Old cluster health.** `oc exec $(primary $OLD) -c database -- patronictl list` shows a running leader and
   streaming replicas.
3. **Full backup** of the old cluster, and note its label:
   ```bash
   oc exec $OLD-repo-host-0 -c pgbackrest -- pgbackrest backup --stanza=db --repo=2 --type=full
   oc exec $OLD-repo-host-0 -c pgbackrest -- pgbackrest info --stanza=db
   ```
4. **App user secret.** The migration job and the platform chart both read `$NEW-pguser-biohub-api`. Copy the
   old one so the app keeps its credentials:
   ```bash
   oc get secret $OLD-pguser-biohub-api -o json \
     | jq --arg n "$NEW-pguser-biohub-api" '{apiVersion, kind, type, metadata: {name: $n}, data: {user: .data.user, password: .data.password}}' \
     | oc apply -f -
   ```
5. **Scale the old cluster to one instance** (TEST and PROD; DEV already runs one). This frees one volume of
   quota before the new cluster is created. Patch the cluster directly, not through Helm (see step 9):
   ```bash
   oc patch postgrescluster $OLD --type=json -p '[{"op":"replace","path":"/spec/instances/0/replicas","value":1}]'
   oc exec $(primary $OLD) -c database -- patronictl list
   oc get pvc -l postgres-operator.crunchydata.com/cluster=$OLD
   ```
   `patronictl list` should show only the leader from step 2, and one `pgdata` volume should remain. If the
   removed instance's volume is still there, delete it once you have confirmed it isn't the leader's, or the
   quota isn't freed. From here until step D the old cluster has no standby; setting `replicas` back to 2 with
   the same patch re-seeds one from the primary.
6. **Install the new cluster** from a checkout of the PR's commit:
   ```bash
   helm upgrade --install $NEW infrastructure/crunchy-db \
     -f infrastructure/crunchy-db/values.yaml -f infrastructure/crunchy-db/values-$ENV.yaml -n $NS
   ```
   Don't pass `--atomic` or `--wait`, and never `helm rollback` a Crunchy release: a rollback restores a volume
   spec the existing PVCs can't satisfy.
7. **Wait until healthy.** `oc exec $(primary $NEW) -c database -- patronictl list` shows a leader (and, in TEST and PROD, a streaming replica), and
   `oc get postgrescluster $NEW -o jsonpath='{.status.pgbackrest.repos}'` shows the repos with
   `stanzaCreated: true`.
8. **Extensions.** Every one the database uses must be available, `roaringbitmap` at 1.3:
   ```bash
   oc exec $(primary $NEW) -c database -- psql -d $NEW -Atc "SELECT name, default_version FROM pg_available_extensions
     WHERE name IN ('postgis','postgis_raster','postgis_topology','postgis_sfcgal','pgrouting','fuzzystrmatch','pgcrypto','roaringbitmap') ORDER BY 1"
   ```
   If one is missing, stop: nothing has changed for users. `helm uninstall $NEW` undoes the install, and the
   step 5 patch with `"value":2` restores the old cluster's standby.
9. **Leave the old release alone.** `values.yaml` now names the Postgres 18 image, so upgrading the old release
   from this commit would start Postgres 18 on version 17 data. If it ever has to be redeployed, pass
   `--set postgresVersion=17,postGISVersion=3.5,crunchyImage=artifacts.developer.gov.bc.ca/bcgov-docker-local/crunchy-postgres-gis:ubi9-17.7-3.5-2547`
   with its old values. That is the tag the clusters run; the `-20260910` tag in the old `values.yaml` was never
   deployed to them, and passing it would roll the database pods.

## B. Freeze and migrate (the window)

1. **Freeze writes.**
   ```bash
   for d in api queue app martin; do oc scale deploy/biohub-platform-$d-$ENV-deploy --replicas=0; done
   oc exec $(primary $OLD) -c database -- psql -d $OLD -Atc "SELECT usename, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1"
   ```
   Only your own `postgres` session should remain.
2. **Run the migration.** Repeat step A6 with `--set migration.enabled=true`, then follow the job:
   ```bash
   oc logs -f job/biohub-platform-db-migration
   oc get job biohub-platform-db-migration -o jsonpath='{.status.succeeded}'   # 1
   ```
3. **Verify.** Run each query on both clusters (swap `$OLD` for `$NEW`) and diff the output.
   - Row counts per table:
     ```bash
     oc exec -i $(primary $OLD) -c database -- psql -d $OLD -At <<'SQL' > counts-old.txt
     SELECT format('SELECT %L, count(*) FROM %I.%I', schemaname || '.' || tablename, schemaname, tablename)
     FROM pg_tables WHERE schemaname = 'biohub' ORDER BY 1 \gexec
     SQL
     ```
   - `SELECT postgis_full_version()` reports PostGIS 3.6 on the new cluster.
   - Grants: this returns no rows on the new cluster apart from `migration`, `migration_lock` and
     `spatial_ref_sys`:
     ```sql
     SELECT schemaname, tablename FROM pg_tables
     WHERE schemaname IN ('biohub', 'public')
       AND NOT has_table_privilege('biohub_api', format('%I.%I', schemaname, tablename), 'SELECT,INSERT,UPDATE,DELETE');
     ```

## C. Switch the apps

1. **Merge the deploy** for this environment (see the table at the top). The static deploy runs database-setup
   against the new cluster, which applies the `roaringbitmap` migration and re-grants the martin role, and then
   rolls the apps.
2. **Replica counts.** `oc get deploy` shows each workload back at its chart count. Scale up by hand any that
   stayed at 0.
3. **Smoke test.** Sign in, run a search, open the map, and publish a submission from SIMS. The api logs show no
   `permission denied`, and on the new cluster
   `SELECT rb_cardinality(rb_build('{1,2,3}'))` returns 3.
4. **Disarm the job.** Repeat step A6 without `--set migration.enabled=true`.

## D. Soak, then retire the old cluster

1. Soak for 7 days in DEV and TEST and 14 in PROD.
2. `helm list` names the old release; `helm uninstall` it, then confirm with `oc get pvc` that its volumes are
   gone.
3. After PROD's soak, delete the old S3 prefixes (`/biohub/<env>/...`). The new cluster writes to
   `/biohub/<env>-pg18/...`.

## Rollback

- **Before step C1:** scale the workloads back up; they still point at the old cluster, which only lost its
  standby (restore it with the step A5 patch and `"value":2`). Then `helm uninstall $NEW` and delete `$NEW-pguser-biohub-api`.
- **After C1, while the old cluster exists:** revert the environment's values (a PR for DEV, a revert release for
  TEST and PROD) so the apps point at the old cluster again. Revert the `roaringbitmap` migration with them, or
  database-setup fails on Postgres 17. Rows written since C1 are not carried back: a dump from Postgres 18 is not
  guaranteed to restore into 17.
- **After D2:** restore a Postgres 17 cluster from the old S3 prefix with the chart's `dataSource` block, using
  the 17 image and the old prefix.
