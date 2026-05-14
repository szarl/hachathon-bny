import { BatchJobsClient } from "@/app/components/BatchJobsClient";

export default function BatchJobsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black">Batch Jobs</h1>
        <p className="mt-1 text-sm text-black/70">
          Upload multiple PDFs and run the full conversion pipeline without SSE. Each PDF becomes its own job;
          progress is tracked via Supabase job rows.
        </p>
      </header>
      <BatchJobsClient />
    </div>
  );
}
