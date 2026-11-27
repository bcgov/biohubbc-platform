# Materialized view refresh

`../index.ts` runs the job in `cronjob.ts`, which refreshes all six BCGW materialized views in one transaction: `wld_telemetry_all`, `wld_telemetry_public`, `wld_observations_all`, `wld_observations_public`, `wld_incidental_all`, and `wld_incidental_public`. Errors roll back the transaction and the process exits with a nonzero status. These regular refreshes can block readers while running.

The Kubernetes CronJob is defined in `infrastructure/cronjobs/templates/cronjob-mv.yaml`. It uses the database setup image, administrator credentials, and a mounted Crunchy TLS CA. See `infrastructure/cronjobs/README.md` for values and deployment requirements. Umbrella dev/test/prod values enable the dependency with the job suspended; static CI supplies its image tag. PR values disable the dependency. Set `biohub-platform-cronjobs.cronjob.suspend: false` in the umbrella environment values after verifying the migrations to start scheduled runs.

The chart defaults to Sunday at 11 p.m. in `America/Vancouver` and starts suspended. After deploying the view migrations, set `cronjob.suspend: false` in the selected environment values. The PR override disables the job entirely.

To run once locally with database environment variables configured:

```sh
cd database
npm run refresh-materialized-views
```
