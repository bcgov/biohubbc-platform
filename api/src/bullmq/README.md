# BullMQ Background Worker

This service polls `submission_job_queue` for pending rows, pushes them into Redis via BullMQ, and runs workers that update PostgreSQL when work completes.

## How it works
- `publisher.ts` looks for `job_start_timestamp IS NULL AND job_end_timestamp IS NULL` via `SubmissionJobQueueService.getNextUnprocessedJobQueueRecords`, marks the record as started, and enqueues it in Redis.
- `worker.ts` spins up a BullMQ `Worker` + `QueueScheduler`, increments `attempt_count`, runs a handler (currently a placeholder), and records completion (`job_end_timestamp`). Final failures reset the record for requeueing.
- Redis hosts the queue and KEDA/HPA can scale the worker Deployment independently from the API.

## Local usage
1. Set Redis + queue env vars (already in `.env`/`env_config/env.docker`):
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USE_TLS`
   - `BULLMQ_QUEUE_NAME`, `BULLMQ_SYNC_INTERVAL_MS`, `BULLMQ_WORKER_CONCURRENCY`, `BULLMQ_JOB_ATTEMPTS`, `BULLMQ_JOB_TIMEOUT_MS`, `BULLMQ_JOB_BACKOFF_MS`
2. Start Redis and the worker via Docker Compose: `docker compose up redis queue`.
3. Or run directly: `npm install` then `npm run bullmq`.

## Build + deploy artifacts
- Local dev image: `docker build -f api/.docker/bullmq/Dockerfile -t biohub-queue:local ./api`.
- OpenShift image: `docker build -f api/Dockerfile.bullmq -t <registry>/<project>/biohub-platform-queue:<tag> ./api` and reference it in `infrastructure/queue-worker` Helm values.

## Extending
- Add real job logic in `job-handlers.ts` (one handler per queue/job type).
- Tune queue/worker settings through the env vars above; new queues can be created by changing `BULLMQ_QUEUE_NAME` and deploying another worker instance.
- Helm charts `infrastructure/redis` and `infrastructure/queue-worker` wire Redis + the BullMQ worker into OpenShift, with credentials supplied via Secrets.
