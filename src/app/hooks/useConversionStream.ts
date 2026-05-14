"use client";

import { useCallback, useState } from "react";

import type { ClassifiedTopic } from "@/lib/classify";
import type { AssetSummary, JobMetadata, ValidationIssue } from "@/lib/generate";

export type Stage =
  | "idle"
  | "connecting"
  | "extracting"
  | "ocr"
  | "classifying"
  | "generating"
  | "validating"
  | "saving"
  | "done"
  | "error";

type SseEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "topics"; topics: ClassifiedTopic[] }
  | { type: "token"; text: string }
  | { type: "agent1_done"; fileCount: number }
  | { type: "validation"; passed: boolean; issueCount: number; issues: ValidationIssue[] }
  | { type: "files"; files: Record<string, string> }
  | { type: "assets"; assets: AssetSummary[] }
  | { type: "done"; outputUrl: string; metadata: JobMetadata }
  | { type: "error"; error: string };

export type ConversionState = {
  stage: Stage;
  stageLabel: string;
  xmlBuffer: string;
  topics: ClassifiedTopic[];
  validationPassed: boolean | null;
  validationIssues: ValidationIssue[];
  issuesFixed: number;
  files: Record<string, string>;
  assets: AssetSummary[];
  agent1FileCount: number | null;
  outputUrl: string | null;
  metadata: JobMetadata | null;
  error: string | null;
};

export const INITIAL_STATE: ConversionState = {
  stage: "idle",
  stageLabel: "",
  xmlBuffer: "",
  topics: [],
  validationPassed: null,
  validationIssues: [],
  issuesFixed: 0,
  files: {},
  assets: [],
  agent1FileCount: null,
  outputUrl: null,
  metadata: null,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSsePayload(line: string): SseEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) {
    return null;
  }
  try {
    const raw = JSON.parse(trimmed.slice(6)) as unknown;
    if (!isRecord(raw) || typeof raw.type !== "string") {
      return null;
    }
    return raw as SseEvent;
  } catch {
    return null;
  }
}

function handleEvent(prev: ConversionState, event: SseEvent): ConversionState {
  switch (event.type) {
    case "stage":
      return {
        ...prev,
        stage: event.stage as Stage,
        stageLabel: event.label,
      };
    case "topics":
      return { ...prev, topics: event.topics };
    case "token":
      return { ...prev, xmlBuffer: prev.xmlBuffer + event.text };
    case "agent1_done":
      return { ...prev, agent1FileCount: event.fileCount };
    case "validation":
      return {
        ...prev,
        validationPassed: event.passed,
        validationIssues: event.issues,
        issuesFixed: event.issues.filter((i) => i.fixed).length,
      };
    case "files":
      return { ...prev, files: { ...event.files } };
    case "assets":
      return { ...prev, assets: event.assets };
    case "done":
      return {
        ...prev,
        stage: "done",
        stageLabel: "Complete",
        outputUrl: event.outputUrl,
        metadata: event.metadata,
      };
    case "error":
      return {
        ...prev,
        stage: "error",
        stageLabel: "Error",
        error: event.error,
      };
    default: {
      return prev;
    }
  }
}

export function useConversionStream() {
  const [state, setState] = useState<ConversionState>(INITIAL_STATE);

  const startConversion = useCallback(
    async ({ jobId, documentTitle }: { jobId: string; documentTitle?: string }) => {
      setState({
        ...INITIAL_STATE,
        stage: "connecting",
        stageLabel: "Starting conversion…",
      });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, documentTitle }),
        });

        if (!res.ok) {
          const text = await res.text();
          let message = `Request failed (${res.status})`;
          try {
            const parsed = JSON.parse(text) as unknown;
            if (isRecord(parsed) && typeof parsed.error === "string") {
              message = parsed.error;
            }
          } catch {
            if (text.trim()) {
              message = text.trim().slice(0, 500);
            }
          }
          setState((prev) => ({
            ...prev,
            stage: "error",
            stageLabel: "Error",
            error: message,
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setState((prev) => ({
            ...prev,
            stage: "error",
            stageLabel: "Error",
            error: "Response had no body to read.",
          }));
          return;
        }

        const decoder = new TextDecoder();
        let carry = "";

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            carry += decoder.decode(value, { stream: true });
          }
          const lines = carry.split("\n");
          carry = lines.pop() ?? "";
          for (const line of lines) {
            const event = parseSsePayload(line);
            if (event) {
              setState((prev) => handleEvent(prev, event));
            }
          }
          if (done) {
            break;
          }
        }

        carry += decoder.decode();
        if (carry.trim()) {
          const event = parseSsePayload(carry);
          if (event) {
            setState((prev) => handleEvent(prev, event));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          stage: "error",
          stageLabel: "Error",
          error: message,
        }));
      }
    },
    [],
  );

  return { state, startConversion };
}
