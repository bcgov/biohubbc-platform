# Database CronJobs

This chart is a dependency of `infrastructure/biohub-platform`. It runs the database
setup image with a job-specific command, independently of the API and migration job.

- `templates/cronjob-mv.yaml`: Kubernetes CronJob and database secret/TLS configuration.
- `templates/_helpers.tpl`: chart naming, namespace, labels, and image tag helpers.
- `values.yaml`: default schedule, suspension, database settings, image, and resources.
- `Values-dev.yaml`, `values-test.yaml`, `values-prod.yaml`, `values-pr.yaml`: standalone environment overrides.
- `../biohub-platform/values-{env}.yaml`: umbrella overrides under `biohub-platform-cronjobs`.

The database entry point is `database/src/cronjobs/index.ts`, run from the database
setup image. It refreshes `bcgw.wld_telemetry_all` then `bcgw.wld_telemetry_public`.
The schedule is Sunday at 11 p.m. in `America/Vancouver`, including daylight-saving changes.

After deploying the view migrations, set `app.materializedViewRefresh.disabled: false`
in the appropriate environment override. PR jobs always stay suspended. The deployment
workflows supply the image build tag; no separate image build is needed.
