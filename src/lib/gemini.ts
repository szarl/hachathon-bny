import "server-only";

import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const geminiModels = {
  classify: process.env.GEMINI_CLASSIFY_MODEL ?? DEFAULT_GEMINI_MODEL,
  generate: process.env.GEMINI_GENERATE_MODEL ?? DEFAULT_GEMINI_MODEL,
  validate: process.env.GEMINI_VALIDATE_MODEL ?? DEFAULT_GEMINI_MODEL,
} as const;

const DEFAULT_AGENT1_MAX_OUTPUT_TOKENS = 65_536;
const DEFAULT_AGENT2_MAX_OUTPUT_TOKENS = 65_536;
const GEMINI_AGENT_OUT_MIN = 4096;
const GEMINI_AGENT_OUT_CAP = 131_072;

function clampGeminiAgentOutput(raw: number): number {
  return Math.min(Math.max(raw, GEMINI_AGENT_OUT_MIN), GEMINI_AGENT_OUT_CAP);
}

/** Token ceiling for Agent 1 (delimited XML stream); override GEMINI_AGENT1_MAX_OUTPUT_TOKENS. */
export function maxAgent1OutputTokens(): number {
  const s = process.env.GEMINI_AGENT1_MAX_OUTPUT_TOKENS?.trim();
  if (s && /^\d+$/.test(s)) {
    return clampGeminiAgentOutput(Number.parseInt(s, 10));
  }
  return DEFAULT_AGENT1_MAX_OUTPUT_TOKENS;
}

/** Token ceiling for Agent 2 (JSON ValidationResult); override GEMINI_AGENT2_MAX_OUTPUT_TOKENS. */
export function maxAgent2OutputTokens(): number {
  const s = process.env.GEMINI_AGENT2_MAX_OUTPUT_TOKENS?.trim();
  if (s && /^\d+$/.test(s)) {
    return clampGeminiAgentOutput(Number.parseInt(s, 10));
  }
  return DEFAULT_AGENT2_MAX_OUTPUT_TOKENS;
}

/** When false, the generate route skips the Agent 2 Gemini call; default is enabled. */
export function isGeminiAgent2Enabled(): boolean {
  const v = process.env.GEMINI_AGENT2_ENABLED?.trim().toLowerCase();
  if (!v) {
    return true;
  }
  if (v === "false" || v === "0" || v === "no" || v === "off") {
    return false;
  }
  return true;
}

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini API calls.");
    }

    geminiClient = new GoogleGenAI({ apiKey });
  }

  return geminiClient;
}
