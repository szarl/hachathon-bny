/**
 * PRD-15 live smoke checks (no secrets). Fails with exit 2 if
 * SUPABASE_SERVICE_ROLE_KEY is missing on the deployment.
 *
 * Usage: node tests/e2e-prod-smoke.mjs
 * Optional: E2E_BASE_URL=https://your-deployment.vercel.app
 */
const base = (process.env.E2E_BASE_URL ?? "https://hachathon-bny.vercel.app").replace(/\/$/, "");

async function main() {
  const health = await fetch(`${base}/api/extract`);
  if (!health.ok) {
    throw new Error(`/api/extract GET failed: ${health.status}`);
  }
  const healthJson = await health.json();
  if (!healthJson.ok || healthJson.runtime !== "python") {
    throw new Error(`Unexpected health JSON: ${JSON.stringify(healthJson)}`);
  }

  const pdfUrl = process.env.E2E_SAMPLE_PDF_URL ?? "https://pdfobject.com/pdf/sample.pdf";
  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    throw new Error(`Could not download sample PDF (${pdfUrl}): ${pdfRes.status}`);
  }
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  const extractFd = new FormData();
  extractFd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "sample.pdf");

  const extractPost = await fetch(`${base}/api/extract`, { method: "POST", body: extractFd });
  const extractText = await extractPost.text();
  if (!extractPost.ok) {
    throw new Error(`/api/extract POST failed: ${extractPost.status} ${extractText.slice(0, 500)}`);
  }
  const parsed = JSON.parse(extractText);
  if (!Array.isArray(parsed.extractedPages) || parsed.extractedPages.length < 1) {
    throw new Error("extract response missing extractedPages");
  }

  const jobFd = new FormData();
  jobFd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "sample.pdf");
  const jobsPost = await fetch(`${base}/api/jobs`, { method: "POST", body: jobFd });
  const jobsText = await jobsPost.text();

  if (jobsPost.status === 500 && jobsText.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error(
      "Production is missing SUPABASE_SERVICE_ROLE_KEY (Vercel → Settings → Environment Variables → Production).",
    );
    process.exit(2);
  }

  if (jobsPost.status !== 201) {
    throw new Error(`/api/jobs failed: ${jobsPost.status} ${jobsText.slice(0, 500)}`);
  }

  const job = JSON.parse(jobsText);
  if (typeof job.jobId !== "string") {
    throw new Error(`Unexpected jobs response: ${jobsText.slice(0, 500)}`);
  }

  console.log("e2e-prod-smoke: OK", { base, jobId: job.jobId });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
