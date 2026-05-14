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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:items-start">
        <div className="flex flex-col gap-6 md:col-span-2">
          <UploadZone conversionState={state} startConversion={startConversion} />
          <ProgressIndicator state={state} />
          <DownloadButton state={state} />
        </div>
        <div className="min-h-0 md:col-span-3">
          <XmlEditor state={state} />
        </div>
      </div>
      <div className="mt-8 w-full">
        <JobHistory />
      </div>
    </div>
  );
}
