<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-04 — /api/classify route — topic classification

## **Summary**

Implement the POST /api/classify route. Accepts the extractedPages array from PRD-03, sends pages 3+ to Gemini with the full classify system prompt, and returns a typed JSON array of ClassifiedTopic objects.

## **Context**

Receives output from /api/extract. Its output feeds directly into PRD-05 (job creation) and PRD-06 (/api/generate). The classify prompt in api\_classify\_prompt.md must be used verbatim — do not shorten or paraphrase it.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Route exists | POST /api/classify returns 200 for valid extractedPages input. |
| Output schema | Response body is { topics: ClassifiedTopic\[\] } where each topic has: type, title, suggestedFilename, confidence, splitReason, content. |
| Pages 1 and 2 skipped | Cover page and TOC are never included in the output topics. |
| Type values | Every topic.type is one of: concept, task, reference. No other values. |
| Content markers present | Task topics have PREREQ:, CONTEXT:, STEPS:, RESULT: markers in their content field. |
| JSON parse fallback | If Gemini returns markdown-fenced JSON, the route strips fences and parses successfully. |
| Repair fallback | If JSON.parse throws, repairJson() is called and the route still returns 200\. |

## **Tasks**

21. Create /app/api/classify/route.ts

22. Add export const maxDuration \= 60

23. Copy the full SYSTEM\_PROMPT from api\_classify\_prompt.md verbatim into a CLASSIFY\_SYSTEM\_PROMPT constant

24. Implement buildUserMessage() that filters pages where pageNumber \>= 3 and formats page blocks

25. Call genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: CLASSIFY\_SYSTEM\_PROMPT })

26. Call model.generateContent(userMessage) — not streaming, classify is a single blocking call

27. Strip markdown fences from response text before JSON.parse

28. Implement repairJson() fallback using a second Gemini call

29. Filter topics to remove any missing required fields before returning

## **Code reference**

Full implementation in api\_classify\_prompt.md, section "Full Next.js API route".

## **Notes**

| *The classify route does NOT stream. It makes a single blocking call to Gemini and returns the full JSON. The 15 RPM free tier limit means classify \+ generate together \= 2 calls; add await new Promise(r \=\> setTimeout(r, 2000)) between them if hitting 429s.* |
| :---- |

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- Classification should run inside the backend-owned `/api/generate` pipeline, not as a browser-orchestrated standalone call.
- A standalone helper/route is optional for testing, but the production user flow should be: `/api/jobs` then `/api/generate`.
- Prompt source is `docs/prompts-context/api_classify_prompt.md`; copy the runtime system prompt into `src/lib/prompts.ts`.
- Use `@google/genai` with `GEMINI_CLASSIFY_MODEL`, defaulting to `gemini-2.0-flash`.
- Extend classified topics with source and image hints:

```ts
type ClassifiedTopic = {
  type: "concept" | "task" | "reference";
  title: string;
  suggestedFilename: string;
  confidence: "high" | "medium" | "low";
  splitReason: string | null;
  content: string;
  sourcePages?: number[];
  relatedImages?: string[];
};
```

- Repair fenced/broken JSON once.
- Normalize filenames to safe lowercase snake case with `c_`, `t_`, or `r_` prefixes.
- Fail clearly if classification returns no usable topics.


