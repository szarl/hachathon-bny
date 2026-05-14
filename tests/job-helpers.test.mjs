import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const TS_OPTS = {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
};

async function loadJobHelpers() {
  const jobsPath = fileURLToPath(new URL("../src/lib/jobs.ts", import.meta.url));
  const errorMessagePath = fileURLToPath(new URL("../src/lib/error-message.ts", import.meta.url));

  const [jobsSource, errorMessageSource] = await Promise.all([
    readFile(jobsPath, "utf8"),
    readFile(errorMessagePath, "utf8"),
  ]);

  const errorMessageJs = ts.transpileModule(errorMessageSource, TS_OPTS).outputText;

  let jobsJs = ts.transpileModule(jobsSource, TS_OPTS).outputText;
  jobsJs = jobsJs
    .replace('import { getErrorMessage } from "@/lib/error-message";\r\n', "")
    .replace('import { getErrorMessage } from "@/lib/error-message";\n', "")
    .replace('export { getErrorMessage } from "@/lib/error-message";\r\n', "")
    .replace('export { getErrorMessage } from "@/lib/error-message";\n', "");

  const combined = `${errorMessageJs}\n${jobsJs}`;

  const encoded = Buffer.from(combined, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function createSupabaseMock({ uploadError = null } = {}) {
  const calls = [];

  const supabase = {
    from(table) {
      return {
        insert(payload) {
          calls.push(["insert", table, payload]);
          return {
            select(columns) {
              calls.push(["selectAfterInsert", columns]);
              return {
                async single() {
                  return { data: { id: "job-123" }, error: null };
                },
              };
            },
          };
        },
        update(payload) {
          calls.push(["update", table, payload]);
          return {
            async eq(column, value) {
              calls.push(["eq", column, value]);
              return { error: null };
            },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, file, options) {
            calls.push(["upload", bucket, path, file.name, options]);
            return { error: uploadError };
          },
          getPublicUrl(path) {
            calls.push(["getPublicUrl", bucket, path]);
            return {
              data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` },
            };
          },
        };
      },
    },
  };

  return { supabase, calls };
}

test("validatePdfUpload rejects non-PDF files and files larger than 50 MB", async () => {
  const { validatePdfUpload, MAX_UPLOAD_BYTES } = await loadJobHelpers();

  assert.equal(validatePdfUpload(new File(["x"], "notes.txt", { type: "text/plain" })), "Only PDF files are supported.");

  const largePdf = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "huge.pdf", {
    type: "application/pdf",
  });
  assert.equal(validatePdfUpload(largePdf), "PDF files must be 50 MB or smaller.");
});

test("buildUploadPath keeps the original display name out of the storage path", async () => {
  const { buildUploadPath } = await loadJobHelpers();

  const path = buildUploadPath("job-123", "../Quarterly Report (Final).PDF", new Date("2026-05-14T10:20:30.000Z"));

  assert.equal(path, "job-123/20260514T102030000Z-quarterly-report-final.pdf");
});

test("createJobFromPdf inserts a pending row, uploads the PDF, stores the public URL, and returns ids", async () => {
  const { createJobFromPdf } = await loadJobHelpers();
  const { supabase, calls } = createSupabaseMock();
  const file = new File(["%PDF"], "Quarterly Report.pdf", { type: "application/pdf" });

  const result = await createJobFromPdf(file, supabase, new Date("2026-05-14T10:20:30.000Z"));

  assert.deepEqual(result, {
    jobId: "job-123",
    pdfUrl: "https://example.supabase.co/storage/v1/object/public/uploads/job-123/20260514T102030000Z-quarterly-report.pdf",
  });
  assert.deepEqual(calls[0], [
    "insert",
    "jobs",
    { filename: "Quarterly Report.pdf", status: "pending", metadata: {} },
  ]);
  assert.deepEqual(calls[2].slice(0, 4), [
    "upload",
    "uploads",
    "job-123/20260514T102030000Z-quarterly-report.pdf",
    "Quarterly Report.pdf",
  ]);
  assert.deepEqual(calls[4], [
    "update",
    "jobs",
    {
      pdf_url: "https://example.supabase.co/storage/v1/object/public/uploads/job-123/20260514T102030000Z-quarterly-report.pdf",
      error: null,
    },
  ]);
});

test("createJobFromPdf sets batch_id column and metadata when batchId option is set", async () => {
  const { createJobFromPdf } = await loadJobHelpers();
  const { supabase, calls } = createSupabaseMock();
  const file = new File(["%PDF"], "Report.pdf", { type: "application/pdf" });
  const bid = "550e8400-e29b-41d4-a716-446655440000";

  await createJobFromPdf(file, supabase, new Date("2026-05-14T10:20:30.000Z"), { batchId: bid });

  assert.deepEqual(calls[0], [
    "insert",
    "jobs",
    {
      filename: "Report.pdf",
      status: "pending",
      batch_id: bid,
      metadata: { batch_id: bid },
    },
  ]);
});

test("createJobFromPdf merges custom metadata with batch_id when both provided", async () => {
  const { createJobFromPdf } = await loadJobHelpers();
  const { supabase, calls } = createSupabaseMock();
  const file = new File(["%PDF"], "Report.pdf", { type: "application/pdf" });
  const bid = "660e8400-e29b-41d4-a716-446655440001";

  await createJobFromPdf(file, supabase, new Date("2026-05-14T10:20:30.000Z"), {
    batchId: bid,
    metadata: { source: "batch-ui" },
  });

  assert.deepEqual(calls[0], [
    "insert",
    "jobs",
    {
      filename: "Report.pdf",
      status: "pending",
      batch_id: bid,
      metadata: { source: "batch-ui", batch_id: bid },
    },
  ]);
});

test("documentTitleFromFilename mirrors upload-zone filename rules", async () => {
  const { documentTitleFromFilename } = await loadJobHelpers();

  assert.equal(documentTitleFromFilename("Q1_Report-final.PDF"), "Q1 Report final");
  assert.equal(documentTitleFromFilename("single.pdf"), "single");
});

test("createJobFromPdf marks the job error when storage upload fails", async () => {
  const { createJobFromPdf } = await loadJobHelpers();
  const { supabase, calls } = createSupabaseMock({ uploadError: new Error("bucket unavailable") });
  const file = new File(["%PDF"], "source.pdf", { type: "application/pdf" });

  await assert.rejects(
    () => createJobFromPdf(file, supabase, new Date("2026-05-14T10:20:30.000Z")),
    /bucket unavailable/,
  );

  assert.deepEqual(calls.at(-2), ["update", "jobs", { status: "error", error: "bucket unavailable" }]);
  assert.deepEqual(calls.at(-1), ["eq", "id", "job-123"]);
});

test("setJobStatus updates the jobs row and merges extra fields", async () => {
  const { setJobStatus } = await loadJobHelpers();
  const { supabase, calls } = createSupabaseMock();

  await setJobStatus("job-123", "saving", { metadata: { fileCount: 4 } }, supabase);

  assert.deepEqual(calls, [
    ["update", "jobs", { status: "saving", metadata: { fileCount: 4 }, error: null }],
    ["eq", "id", "job-123"],
  ]);
});
