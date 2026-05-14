import "server-only";

import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const geminiModels = {
  classify: process.env.GEMINI_CLASSIFY_MODEL ?? DEFAULT_GEMINI_MODEL,
  generate: process.env.GEMINI_GENERATE_MODEL ?? DEFAULT_GEMINI_MODEL,
  validate: process.env.GEMINI_VALIDATE_MODEL ?? DEFAULT_GEMINI_MODEL,
} as const;

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
