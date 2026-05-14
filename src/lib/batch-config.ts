/** Maximum PDFs per batch run (upload + `/api/batch/run`), aligned with route handler. */
export const MAX_BATCH_JOBS = 12;

/** Max concurrent `/api/batch/run` invocations (one job per request) to limit Gemini / cold starts. */
export const BATCH_RUN_CONCURRENCY = 4;

/** Max parallel uploads when creating jobs for a batch. */
export const BATCH_UPLOAD_CONCURRENCY = 4;
