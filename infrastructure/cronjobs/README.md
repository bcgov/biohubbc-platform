# Database CronJobs

This standalone chart runs `npm run refresh-materialized-views` in the database setup image. The TypeScript entry point is `database/src/cronjobs/index.ts`. The view list is maintained in `materialized-views/cronjob.ts`, not Helm values.

- `values.yaml`: shared schedule, image repository, database secret keys, TLS, and resources.
- `Values-dev.yaml`, `values-test.yaml`, `values-prod.yaml`: database hosts and secret names.
- `values-pr.yaml`: disables the scheduled job in preview deployments.
- `templates/cronjob-mv.yaml`: Node command, database environment variables, and TLS mount.

The dev filename currently starts with an uppercase `V`; use that exact spelling on Linux. Helm merges the chart defaults with the selected override file. Supply `image.tag` from the database setup build, for example:

```sh
helm template refresh infrastructure/cronjobs -f infrastructure/cronjobs/Values-dev.yaml --set-string image.tag=YOUR_DATABASE_SETUP_BUILD_TAG
```

Jobs default to Sunday at 11 p.m. in `America/Vancouver`, with overlapping runs forbidden. They start suspended. After confirming the view migrations and referenced OpenShift services/secrets exist, set `cronjob.suspend: false` in the environment values. CPU and memory settings are initial defaults to review against namespace quota.

The umbrella chart includes this chart as `biohub-platform-cronjobs`, gated by `cronjobs.enabled` (false by default). Umbrella dev/test/prod values enable the dependency and supply database overrides under that alias, while PR values disable it. Static deployment CI supplies the database setup image tag. Jobs remain suspended until `biohub-platform-cronjobs.cronjob.suspend` is set to false in the umbrella environment values. Child-chart environment files are not automatically loaded by an umbrella deployment.
