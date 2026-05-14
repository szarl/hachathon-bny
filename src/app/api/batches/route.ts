import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("batches")
      .insert({ metadata: {} })
      .select("id")
      .single();

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    const id = (data as { id?: string } | null)?.id;
    if (!id) {
      throw new Error("Supabase did not return a batch id.");
    }

    return NextResponse.json({ batchId: id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
