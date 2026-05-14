import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage } from "@/lib/error-message";

export { getErrorMessage } from "@/lib/error-message";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type JobStatus =
  | "pending"
  | "extracting"
  | "ocr"
  | "classifying"
  | "generating"
  | "validating"
  | "saving"
  | "done"
  | "error";

type SupabaseLike = Pick<SupabaseClient, "from" | "storage">;

type CreateJobResult = {
  jobId: string;
  pdfUrl: string;
};

type JobInsertResult = {
  id?: string;
};

export function validatePdfUpload(file: File): string | null {
  const filename = file.name.toLowerCase();

  if (!filename.endsWith(".pdf") || (file.type !== "" && file.type !== "application/pdf")) {
    return "Only PDF files are supported.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "PDF files must be 50 MB or smaller.";
  }

  return null;
}

export function buildUploadPath(jobId: string, filename: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(".", "");
  return `${jobId}/${timestamp}-${sanitizeStorageFilename(filename)}`;
}

export function sanitizeStorageFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? "document.pdf";
  const withoutExtension = basename.replace(/\.pdf$/i, "");
  const safeName = withoutExtension
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `${safeName || "document"}.pdf`;
}

export async function createJobFromPdf(
  file: File,
  supabase: SupabaseLike,
  now = new Date(),
): Promise<CreateJobResult> {
  const validationError = validatePdfUpload(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data: job, error: insertError } = await supabase
    .from("jobs")
    .insert({ filename: file.name, status: "pending" })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(getErrorMessage(insertError));
  }

  const jobId = (job as JobInsertResult | null)?.id;

  if (!jobId) {
    throw new Error("Supabase did not return a job id.");
  }

  try {
    const storagePath = buildUploadPath(jobId, file.name, now);
    const { error: uploadError } = await supabase.storage.from("uploads").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(getErrorMessage(uploadError));
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(storagePath);
    const pdfUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ pdf_url: pdfUrl, error: null })
      .eq("id", jobId);

    if (updateError) {
      throw new Error(getErrorMessage(updateError));
    }

    return { jobId, pdfUrl };
  } catch (error) {
    const message = getErrorMessage(error);
    await setJobStatus(jobId, "error", { error: message }, supabase);
    throw new Error(message);
  }
}

export async function setJobStatus(
  jobId: string,
  status: JobStatus,
  extra: Record<string, unknown> = {},
  supabase: SupabaseLike,
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (status !== "error" && !("error" in extra)) {
    payload.error = null;
  }

  const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);

  if (error) {
    throw new Error(getErrorMessage(error));
  }
}
