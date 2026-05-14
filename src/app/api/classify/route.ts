import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildUserMessage,
  type ClassifiedTopic,
  type ExtractedPage,
  parseClassifiedTopics,
  stripJsonFences,
} from "@/lib/classify";
import { getErrorMessage } from "@/lib/error-message";
import { geminiModels, getGeminiClient } from "@/lib/gemini";
import { CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClassifyRequestBody = {
  extractedPages?: ExtractedPage[];
};

export async function POST(req: NextRequest) {
  let body: ClassifyRequestBody;

  try {
    body = (await req.json()) as ClassifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.extractedPages)) {
    return NextResponse.json(
      { error: "Request body must include extractedPages as an array." },
      { status: 400 },
    );
  }

  const contentPages = body.extractedPages.filter((page) => page.pageNumber >= 3);

  if (contentPages.length === 0) {
    return NextResponse.json(
      { error: "No content pages available to classify after skipping pages 1 and 2." },
      { status: 400 },
    );
  }

  try {
    const userMessage = buildUserMessage(body.extractedPages);
    const rawText = await generateClassification(userMessage);
    let topics: ClassifiedTopic[];

    try {
      topics = parseClassifiedTopics(rawText);
    } catch {
      topics = await repairJson(rawText);
    }

    if (topics.length === 0) {
      return NextResponse.json(
        { error: "Classification returned no usable topics." },
        { status: 502 },
      );
    }

    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

async function generateClassification(userMessage: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.classify,
    contents: userMessage,
    config: {
      systemInstruction: CLASSIFY_SYSTEM_PROMPT,
      temperature: 0,
    },
  });

  return response.text ?? "";
}

async function repairJson(brokenOutput: string): Promise<ClassifiedTopic[]> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: geminiModels.classify,
    contents:
      "The following output was supposed to be a valid JSON array of ClassifiedTopic objects " +
      "but failed to parse. Fix the JSON syntax and return only the corrected JSON array, " +
      `no markdown fences, no explanation:\n\n${stripJsonFences(brokenOutput)}`,
    config: {
      temperature: 0,
    },
  });

  return parseClassifiedTopics(response.text ?? "");
}
