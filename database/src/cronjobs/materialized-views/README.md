# Materialized view refresh

`../index.ts` runs the job in `cronjob.ts`, which refreshes
`bcgw.wld_telemetry_all` followed by `bcgw.wld_telemetry_public` in one transaction.
Errors roll back the transaction and the process exits with a nonzero status.
These regular refreshes can block readers while running.

The Kubernetes CronJob lives in
`infrastructure/cronjobs/templates/cronjob-mv.yaml` and uses
the database setup image, administrator credentials, and Crunchy TLS CA.
It deploys with the existing platform umbrella chart.

Defaults in `infrastructure/cronjobs/values.yaml` schedule it for Sundays
at 11 p.m. in `America/Vancouver`, following daylight-saving changes. Kubernetes
1.27 or later is required for the timezone field. Jobs cannot overlap.

The job starts suspended until the migrations creating both views are deployed.
To enable it, add this override to the appropriate
`infrastructure/biohub-platform/values-{env}.yaml` under the existing cronjobs section:

```yaml
biohub-platform-cronjobs:
  app:
    materializedViewRefresh:
      disabled: false
```

PR jobs remain suspended regardless of this setting. For standalone cronjobs
chart deployments, put the same setting directly under `app`.

To run locally with the database setup environment variables configured:

```sh
cd database
npm run refresh-materialized-views
```
