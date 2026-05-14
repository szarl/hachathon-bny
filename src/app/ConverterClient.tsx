"use client";

import { UploadZone } from "@/app/components/UploadZone";
import { useConversionStream } from "@/app/hooks/useConversionStream";

export function ConverterClient() {
  const { state, startConversion } = useConversionStream();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-8">
      <UploadZone conversionState={state} startConversion={startConversion} />
      {state.error && state.stage === "error" ? (
        <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
