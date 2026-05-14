import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createJobFromPdf, getErrorMessage, validatePdfUpload } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request body must be multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Request must include a PDF file in the file field." }, { status: 400 });
  }

  const validationError = validatePdfUpload(file);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await createJobFromPdf(file, getSupabaseAdmin());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
