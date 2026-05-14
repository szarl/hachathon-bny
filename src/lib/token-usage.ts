export type TokenUsageCall = {
  phase: string;
  model: string;
  prompt: number;
  output: number;
  thoughts: number;
  toolUse: number;
  cached: number;
  total: number;
};

export type TokenUsageSummary = {
  prompt: number;
  output: number;
  thoughts: number;
  toolUse: number;
  cached: number;
  total: number;
  calls: TokenUsageCall[];
};

type GeminiUsageLike = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  responseTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
  toolUsePromptTokenCount?: unknown;
  cachedContentTokenCount?: unknown;
  totalTokenCount?: unknown;
};

function finiteTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function normalizeGeminiTokenUsage(
  phase: string,
  model: string,
  usageMetadata: GeminiUsageLike | null | undefined,
): TokenUsageCall | null {
  if (!usageMetadata) {
    return null;
  }

  const prompt = finiteTokenCount(usageMetadata.promptTokenCount);
  const output = finiteTokenCount(
    usageMetadata.candidatesTokenCount ?? usageMetadata.responseTokenCount,
  );
  const thoughts = finiteTokenCount(usageMetadata.thoughtsTokenCount);
  const toolUse = finiteTokenCount(usageMetadata.toolUsePromptTokenCount);
  const cached = finiteTokenCount(usageMetadata.cachedContentTokenCount);
  const total =
    finiteTokenCount(usageMetadata.totalTokenCount) ||
    prompt + output + thoughts + toolUse;

  if (prompt + output + thoughts + toolUse + cached + total === 0) {
    return null;
  }

  return {
    phase,
    model,
    prompt,
    output,
    thoughts,
    toolUse,
    cached,
    total,
  };
}

export function summarizeTokenUsage(calls: TokenUsageCall[]): TokenUsageSummary {
  return calls.reduce<TokenUsageSummary>(
    (summary, call) => ({
      prompt: summary.prompt + call.prompt,
      output: summary.output + call.output,
      thoughts: summary.thoughts + call.thoughts,
      toolUse: summary.toolUse + call.toolUse,
      cached: summary.cached + call.cached,
      total: summary.total + call.total,
      calls: [...summary.calls, call],
    }),
    {
      prompt: 0,
      output: 0,
      thoughts: 0,
      toolUse: 0,
      cached: 0,
      total: 0,
      calls: [],
    },
  );
}

export function formatTokenTotal(value: unknown): string {
  const total = finiteTokenCount(value);

  if (total < 1000) {
    return String(total);
  }

  if (total < 1_000_000) {
    return `${formatCompact(total / 1000)}k`;
  }

  return `${formatCompact(total / 1_000_000)}m`;
}

function formatCompact(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
