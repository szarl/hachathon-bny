"use client";

import { ProgressIndicator } from "@/app/components/ProgressIndicator";
import { UploadZone } from "@/app/components/UploadZone";
import { useConversionStream } from "@/app/hooks/useConversionStream";

export function ConverterClient() {
  const { state, startConversion } = useConversionStream();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-8">
      <UploadZone conversionState={state} startConversion={startConversion} />
      <ProgressIndicator state={state} />
    </div>
  );
}
