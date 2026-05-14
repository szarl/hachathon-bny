"use client";

import { DownloadButton } from "@/app/components/DownloadButton";
import { JobHistory } from "@/app/components/JobHistory";
import { ProgressIndicator } from "@/app/components/ProgressIndicator";
import { UploadZone } from "@/app/components/UploadZone";
import { XmlEditor } from "@/app/components/XmlEditor";
import { useConversionStream } from "@/app/hooks/useConversionStream";

export function ConverterClient() {
  const { state, startConversion } = useConversionStream();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <UploadZone conversionState={state} startConversion={startConversion} />
      <ProgressIndicator state={state} />
      <DownloadButton state={state} />
      <XmlEditor state={state} />
      <JobHistory />
    </div>
  );
}
