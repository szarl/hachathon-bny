<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-06 — /api/generate route — Agent 1 DITA generation

## **Summary**

Implement the SSE-streaming POST /api/generate route. Agent 1 (Gemini) receives the classified topics and generates complete DITA XML files, streaming tokens to the browser in real time.

## **Context**

This is the core AI route. It must stream tokens via SSE so Monaco editor fills live. The AGENT\_1\_SYSTEM prompt from two\_agent\_gemini\_pipeline.md must be used verbatim.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| SSE stream returns | POST /api/generate returns Content-Type: text/event-stream immediately. |
| Token events stream | data: {"type":"token","text":"..."} events arrive continuously during generation. |
| Stage events sent | data: {"type":"stage","stage":"generating","label":"Agent 1 — generating DITA"} is the first event. |
| agent1\_done event sent | data: {"type":"agent1\_done","fileCount":N} is sent after streaming completes. |
| Files parsed | parseFiles() correctly splits the raw streamed text on %%FILE: delimiters. |
| Correct file count | For the sample PDF (3 content sections), agent1Files has 4 keys: 3 .dita files \+ 1 .ditamap. |
| maxDuration set | export const maxDuration \= 60 is present at the top of the file. |

## **Tasks**

35. Create /app/api/generate/route.ts

36. Add export const maxDuration \= 60

37. Copy AGENT\_1\_SYSTEM prompt from two\_agent\_gemini\_pipeline.md verbatim

38. Implement runAgent1() using model.generateContentStream()

39. In the stream loop, call onToken(text) which calls send({ type: "token", text })

40. After stream completes, call parseFiles(fullText) to split into file map

41. Send agent1\_done event with fileCount

42. Implement parseFiles() using the regex: /%%FILE:(\[^%\]+)%%\\n(\[\\s\\S\]\*?)(?=%%FILE:|%%END%%|$)/g

43. Implement the SSE ReadableStream wrapper as shown in two\_agent\_gemini\_pipeline.md

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "/app/api/generate/route.ts".

## **Notes**

| *Agent 1 does NOT call Agent 2\. Agent 2 is called after Agent 1 completes, still inside the same SSE stream. Both agents run sequentially inside the single POST /api/generate handler.* |
| :---- |

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- `/api/generate` should own the full pipeline after job creation: extract, optional OCR, classify, Agent 1, deterministic checks, Agent 2, ZIP upload, and completion.
- The request body should be `{ jobId, documentTitle }`. `productName` is fixed internally as `BNY Platform`.
- Prompt source is `docs/prompts-context/api_generate_prompt.md`; copy the runtime Agent 1 prompt into `src/lib/prompts.ts`.
- Use `@google/genai` with `GEMINI_GENERATE_MODEL`, defaulting to `gemini-2.0-flash`.
- Agent 1 must stream delimiter-based plain text, not JSON or markdown:

```text
%%FILE:c_example_concept.dita%%
<?xml version="1.0" encoding="UTF-8"?>
...

%%FILE:map.ditamap%%
<?xml version="1.0" encoding="UTF-8"?>
...
%%END%%
```

- Use fixed `map.ditamap`.
- During streaming, Monaco receives a raw live preview only. Do not validate partial XML.
- If `parseFiles()` fails after streaming completes, do one non-streamed formatting repair retry before returning an error.


