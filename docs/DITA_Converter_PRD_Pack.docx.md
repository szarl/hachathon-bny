  
AI in Finance Hackathon 2026

**DITA Conversion Tool**

Product Requirements Document

PRD-01 through PRD-15

May 14, 2026  ·  Confidential

*Stack: Next.js 14 · TypeScript · Gemini 2.0 Flash · Supabase · Vercel · Monaco Editor*

> **Implementation update — May 13, 2026:** This imported PRD pack is no longer the only source of implementation truth. Use `docs/architecture-decisions.md` plus the split PRD files as the current plan. The key updates are: backend-owned pipeline after `/api/jobs`, deployed Python extractor boundary, `@google/genai`, split Gemini model env vars, public demo buckets with server-owned writes, image asset extraction, optional OCR fallback, and one `/api/generate` SSE stream.

# **Document overview**

This document contains 15 Product Requirements Documents (PRDs) for the DITA Conversion Tool. Each PRD is self-contained and written for direct execution by an AI agent or developer. They are ordered by dependency — complete them in sequence.

| PRD | Title | Priority | Effort | Phase |
| :---- | :---- | :---- | :---- | :---- |
| PRD-01 | Project scaffold and environment setup | P0 | 45 min | 1 of 5 |
| PRD-02 | Supabase database and storage setup | P0 | 45 min | 1 of 5 |
| PRD-03 | /api/extract route — PDF to structured text | P0 | 30 min | 2 of 5 |
| PRD-04 | /api/classify route — topic classification | P0 | 30 min | 2 of 5 |
| PRD-05 | Job creation and Supabase write | P0 | 20 min | 2 of 5 |
| PRD-06 | /api/generate route — Agent 1 DITA generation | P0 | 40 min | 2 of 5 |
| PRD-07 | /api/generate route — Agent 2 validation | P0 | 30 min | 2 of 5 |
| PRD-08 | /api/generate route — Storage upload and completion | P0 | 20 min | 2 of 5 |
| PRD-09 | useConversionStream React hook | P0 | 25 min | 3 of 5 |
| PRD-10 | Upload zone and conversion trigger UI | P0 | 30 min | 3 of 5 |
| PRD-11 | 5-stage progress indicator | P0 | 20 min | 3 of 5 |
| PRD-12 | Monaco XML editor with file tabs | P0 | 25 min | 3 of 5 |
| PRD-13 | Download button and job history table | P1 | 20 min | 3 of 5 |
| PRD-14 | Main page layout and BNY branding | P1 | 20 min | 3 of 5 |
| PRD-15 | Vercel deployment and end-to-end test | P0 | 30 min | 4 of 5 |

| *Dependency order: PRD-01 and PRD-02 can run in parallel. All others depend on both. PRD-03 through PRD-08 form the backend pipeline and should be built in order. PRD-09 through PRD-14 form the frontend and depend on the hook (PRD-09) being done first. PRD-15 must be last.* |
| :---- |

# **PRD-01 — Project scaffold and environment setup**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 45 min |
| **Phase** | 1 of 5 |
| **Owner** | Full-stack dev |

## **Summary**

Bootstrap the Next.js project with TypeScript, install all dependencies, configure environment variables, and verify the local development server runs without errors.

## **Context**

This PRD must be completed before all others. No other PRD can be started until the scaffold is verified.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| npx create-next-app | Run: npx create-next-app@latest dita-converter \--typescript \--tailwind \--app. Project directory created with no errors. |
| Dependencies installed | Run: npm install @google/generative-ai @supabase/supabase-js @monaco-editor/react jszip pdfplumber. All packages resolve without conflict. |
| Env vars configured | .env.local exists with: GEMINI\_API\_KEY, NEXT\_PUBLIC\_SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY. None are empty strings. |
| Dev server runs | npm run dev starts without errors. http://localhost:3000 returns a 200\. |
| TypeScript compiles | npx tsc \--noEmit exits with code 0\. |
| Vercel CLI installed | npm install \-g vercel. vercel \--version prints a version string. |

## **Tasks**

1. Create Next.js app with TypeScript \+ Tailwind \+ App Router

2. Install all dependencies listed above

3. Create .env.local with the three required variables

4. Create /app/lib/gemini.ts exporting a configured GoogleGenerativeAI instance

5. Create /app/lib/supabase.ts exporting a configured Supabase client using service role key

6. Verify dev server starts on port 3000

7. Run tsc \--noEmit and fix any initial type errors

## **Notes**

| *Do not install pdfplumber via npm — it is a Python package. It will be invoked via child\_process in PRD-03. Python 3 must be available at python3 on the PATH.* |
| :---- |

# **PRD-02 — Supabase database and storage setup**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 45 min |
| **Phase** | 1 of 5 |
| **Owner** | Full-stack dev |

## **Summary**

Create the Supabase project, run the jobs table migration, create two storage buckets (uploads, outputs), and verify realtime is enabled on the jobs table.

## **Context**

Must be completed before PRD-05 (job creation) and PRD-09 (realtime hook). Can be done in parallel with PRD-01.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| jobs table exists | SELECT \* FROM jobs LIMIT 1 returns 0 rows with no error in the Supabase SQL editor. |
| Row-level security | Three RLS policies exist on jobs: public read (SELECT), public insert (INSERT), public update (UPDATE). |
| uploads bucket | Storage → uploads bucket exists. Public access: off. Max file size: 50MB. |
| outputs bucket | Storage → outputs bucket exists. Public access: on (so signed URLs work without auth). |
| Realtime enabled | Database → Replication → jobs table is toggled ON for INSERT and UPDATE events. |
| Env vars match | NEXT\_PUBLIC\_SUPABASE\_URL and SUPABASE\_SERVICE\_ROLE\_KEY in .env.local match the values in Supabase → Settings → API. |

## **Tasks**

8. Create a new Supabase project in the dashboard

9. Open SQL editor and run the following migration exactly:

Run this SQL migration in the Supabase SQL editor:

create table jobs (

  id          uuid primary key default gen\_random\_uuid(),

  created\_at  timestamptz default now(),

  filename    text not null,

  pdf\_url     text,

  status      text default 'pending',

  topics      jsonb,

  output\_url  text,

  error       text

);

alter table jobs enable row level security;

create policy "public read"   on jobs for select using (true);

create policy "public insert" on jobs for insert with check (true);

create policy "public update" on jobs for update using (true);

10. Create uploads bucket in Storage → New bucket → name: uploads → private

11. Create outputs bucket in Storage → New bucket → name: outputs → public

12. Enable realtime: Database → Replication → toggle jobs table on

13. Copy SUPABASE\_URL and SERVICE\_ROLE\_KEY into .env.local

## **Notes**

| *The status column uses plain text, not an enum, to avoid migration complexity during the hackathon. Valid values are: pending, extracting, classifying, generating, validating, saving, done, error.* |
| :---- |

# **PRD-03 — /api/extract route — PDF to structured text**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 30 min |
| **Phase** | 2 of 5 |
| **Owner** | Backend dev |

## **Summary**

Implement the POST /api/extract route. Accepts a multipart PDF upload, writes it to /tmp, runs a Python pdfplumber subprocess, and returns a JSON array of page objects with text and font size metadata.

## **Context**

This is the first step in the pipeline. Its output feeds directly into PRD-04 (/api/classify). The Python subprocess approach is mandatory — pdf-parse (Node) does not return font size metadata needed for heading detection.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Route exists | POST /api/extract returns 200 for a valid PDF upload. |
| Page objects returned | Response body is { extractedPages: Array\<{ pageNumber: number, text: string, fontSizes: number\[\] }\> }. |
| Cover page included | Page 1 (cover) is present in the array with pageNumber: 1\. |
| Font sizes present | Each page object has a fontSizes array with at least one number greater than 0\. |
| Temp files cleaned up | /tmp contains no .pdf or .py files after the request completes. |
| Error handling | Uploading a non-PDF returns 400 with { error: "No file provided" } or similar. |

## **Tasks**

14. Create /app/api/extract/route.ts

15. Add export const maxDuration \= 60 at the top of the file

16. Implement the PYTHON\_EXTRACTOR string constant exactly as specified in two\_agent\_gemini\_pipeline.md

17. Implement the POST handler: read FormData, write PDF to /tmp/{randomHex}.pdf, write Python script to /tmp/{randomHex}.py

18. Run: const { stdout } \= await execAsync(\`python3 ${pyPath} ${pdfPath}\`)

19. Parse stdout as JSON and return as { extractedPages }

20. In a finally block, unlink both temp files with .catch(() \=\> {})

## **Code reference**

See PDF extractor implementation in api\_classify\_prompt.md, section "PDF extractor to pair with this route".

## **Notes**

| *Install pdfplumber on the machine before the hackathon: pip install pdfplumber. Verify python3 \-c "import pdfplumber; print('ok')" prints ok.* |
| :---- |

# **PRD-04 — /api/classify route — topic classification**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 30 min |
| **Phase** | 2 of 5 |
| **Owner** | Backend dev |

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

# **PRD-05 — Job creation and Supabase write**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 20 min |
| **Phase** | 2 of 5 |
| **Owner** | Full-stack dev |

## **Summary**

Implement job row creation in Supabase at the start of each conversion request. The job ID flows through the entire pipeline and is used to write status updates at each stage.

## **Context**

Job creation happens in the frontend before calling /api/generate. The jobId is passed in the request body to the generate route, which updates status at each stage.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Job created on upload | When the user clicks Convert, a row is inserted into jobs with status: pending and the filename. |
| jobId returned | The insert returns the generated UUID which is stored in React state. |
| jobId passed to API | POST /api/generate body includes { jobId, documentTitle, topics, productName }. |
| Status updates written | After each pipeline stage completes, jobs.status is updated: extracting → classifying → generating → validating → saving → done or error. |
| error field written | If any stage throws, jobs.error is set to the error message string. |

## **Tasks**

30. In the frontend upload handler, call supabase.from("jobs").insert({ filename, status: "pending" }).select().single()

31. Store the returned id in React state as jobId

32. Pass jobId in the POST body to /api/generate

33. In /api/generate/route.ts, implement setJobStatus(jobId, status, extra?) using supabase.from("jobs").update().eq("id", jobId)

34. Call setJobStatus at the start of each stage in the pipeline

## **Notes**

| *The Supabase client in API routes must use the SERVICE\_ROLE\_KEY, not the anon key. The anon key does not have permission to update rows without a user session.* |
| :---- |

# **PRD-06 — /api/generate route — Agent 1 DITA generation**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 40 min |
| **Phase** | 2 of 5 |
| **Owner** | Backend dev |

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

# **PRD-07 — /api/generate route — Agent 2 validation**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 30 min |
| **Phase** | 2 of 5 |
| **Owner** | Backend dev |

## **Summary**

Extend the /api/generate route to run Agent 2 after Agent 1 completes. Agent 2 validates and repairs the generated DITA XML, returns a structured JSON report, and the corrected files are used for all downstream steps.

## **Context**

Implemented inside the same route file as PRD-06. Agent 2 runs after agent1\_done is sent. It uses responseMimeType: "application/json" to force structured output.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Stage event sent | data: {"type":"stage","stage":"validating","label":"Agent 2 — validating XML"} is sent before Agent 2 call. |
| Validation event sent | data: {"type":"validation","passed":bool,"issueCount":N,"issues":\[...\]} is sent after Agent 2 returns. |
| responseMimeType set | Agent 2 model is created with generationConfig: { responseMimeType: "application/json" }. |
| JSON parsed cleanly | ValidationResult is parsed from Agent 2 response with no thrown errors for the sample PDF. |
| Repaired files used | The final files sent in the done event come from validation.files, not agent1Files. |
| 10 validation rules checked | AGENT\_2\_SYSTEM prompt contains all 10 rules: XML\_WELL\_FORMED through MAP\_COMPLETENESS. |

## **Tasks**

44. Copy AGENT\_2\_SYSTEM prompt from two\_agent\_gemini\_pipeline.md verbatim

45. Implement runAgent2(files) using model.generateContent() (not streaming)

46. Set generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }

47. Add 2-second delay before Agent 2 call: await new Promise(r \=\> setTimeout(r, 2000))

48. Parse the JSON response into ValidationResult interface

49. Add fence-stripping fallback: raw.replace(/^\`\`\`(?:json)?\\s\*/m, "").replace(/\\s\*\`\`\`$/m, "").trim()

50. Send validation SSE event with passed, issueCount, issues array

51. Use validation.files (not agent1Files) for all subsequent steps

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "Agent 2: validator".

## **Notes**

| *The 2-second delay between Agent 1 and Agent 2 prevents 429 rate limit errors on the Gemini free tier (15 RPM). Do not remove it.* |
| :---- |

# **PRD-08 — /api/generate route — Storage upload and completion**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 20 min |
| **Phase** | 2 of 5 |
| **Owner** | Backend dev |

## **Summary**

Complete the /api/generate route by zipping the validated DITA files, uploading the ZIP to Supabase Storage outputs bucket, writing the public URL to the jobs row, and sending the done SSE event.

## **Context**

Final stage of the generate route, after Agent 2 completes. Requires jszip (already installed in PRD-01).

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| ZIP created | All validated .dita files and the .ditamap are included in the ZIP. |
| ZIP uploaded | File appears at outputs/{jobId}/dita\_output.zip in Supabase Storage. |
| Public URL returned | The public URL is retrievable from supabase.storage.from("outputs").getPublicUrl(path). |
| jobs row updated | jobs.status \= "done" and jobs.output\_url \= publicUrl after upload. |
| files event sent | data: {"type":"files","files":{...}} with the complete file map is sent before done. |
| done event sent | data: {"type":"done","outputUrl":"https://..."} is the last event before stream closes. |
| Error handled | If upload fails, jobs.error is set and data: {"type":"error"} is sent. |

## **Tasks**

52. Implement uploadFilesToStorage(jobId, files) using dynamic import of jszip

53. Create a new JSZip instance, add each file with zip.file(filename, content)

54. Generate buffer: await zip.generateAsync({ type: "nodebuffer" })

55. Upload to Supabase Storage at path outputs/${jobId}/dita\_output.zip with upsert: true

56. Get public URL and return it

57. Call setJobStatus(jobId, "done", { output\_url: outputUrl, topics })

58. Send files event with the full file map

59. Send done event with outputUrl

60. In the catch block, call setJobStatus(jobId, "error", { error: msg }) and send error event

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "Storage upload".

## **Notes**

| *The files SSE event is what populates the Monaco editor tabs. It must be sent before the done event so the UI has the file content before showing the download button.* |
| :---- |

# **PRD-09 — useConversionStream React hook**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 25 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Implement the useConversionStream hook that consumes the SSE stream from /api/generate and maps every event type to typed React state. This hook is the single source of truth for all UI state during conversion.

## **Context**

All frontend components (progress indicator, Monaco editor, validation panel, download button) read from this hook's state. It must be implemented before any UI components.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Hook exists | /app/hooks/useConversionStream.ts exports useConversionStream(). |
| State shape | Hook returns { state: ConversionState, startConversion }. ConversionState matches the interface in two\_agent\_gemini\_pipeline.md exactly. |
| token events | Each token event appends event.text to state.xmlBuffer. |
| stage events | state.stage and state.stageLabel update on each stage event. |
| validation events | state.validationPassed, validationIssues, and issuesFixed update correctly. |
| files events | state.files is populated with the full Record\<string, string\> on the files event. |
| done events | state.stage becomes "done" and state.outputUrl is set. |
| error events | state.stage becomes "error" and state.error is set. |
| SSE chunk splitting | Multi-event chunks (multiple data: lines in one read) are split on newlines and each parsed individually. |

## **Tasks**

61. Create /app/hooks/useConversionStream.ts

62. Define Stage type and ConversionState interface exactly as in two\_agent\_gemini\_pipeline.md

63. Define INITIAL\_STATE constant

64. Implement startConversion(payload) using fetch \+ res.body.getReader()

65. In the read loop, split each chunk on "\\n", filter for lines starting with "data: ", parse JSON

66. Implement handleEvent(event) with a switch on event.type covering all 7 event types

67. Use setState with functional updater (setState(prev \=\> ...)) for all state changes

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "React hook — useConversionStream.ts".

## **Notes**

| *Use try-catch inside the line parsing loop — partial SSE chunks arrive mid-JSON and will throw. Swallow the error and let the next read deliver the complete event.* |
| :---- |

# **PRD-10 — Upload zone and conversion trigger UI**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 30 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Build the PDF upload zone with drag-and-drop support and the Convert button that triggers the full pipeline. On click, the component creates a Supabase job row, calls /api/extract, calls /api/classify, then calls startConversion from the useConversionStream hook.

## **Context**

This is the entry point of the user flow. It orchestrates the three sequential API calls before handing off to the SSE stream.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Drag-and-drop works | Dropping a PDF onto the zone sets the file in state and shows the filename. |
| File input fallback | Clicking the zone opens a file picker filtered to .pdf files. |
| Convert button | Button is disabled until a file is selected. Shows "Convert to DITA" when idle. |
| Loading states | Button label changes: "Extracting…" → "Classifying…" → "Generating…" during the three phases. |
| Job row created | A jobs row is inserted before /api/extract is called. |
| Sequential calls | extract → classify → startConversion are called in order, each awaiting the previous. |
| Error displayed | If any step throws, an error message is shown below the upload zone. |

## **Tasks**

68. Create /app/components/UploadZone.tsx

69. Implement drag-and-drop with onDragOver, onDrop event handlers

70. Implement file input with accept=".pdf"

71. On Convert click: insert jobs row → call POST /api/extract (FormData) → call POST /api/classify (JSON) → call startConversion

72. Update button label at each step using a local phase state

73. Pass jobId, documentTitle (filename without extension), topics, productName: "ABC" to startConversion

## **Notes**

| *documentTitle should be derived from the PDF filename with the .pdf extension removed and hyphens/underscores replaced with spaces. This becomes the \<title\> of the ditamap.* |
| :---- |

# **PRD-11 — 5-stage progress indicator**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 20 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Build the visual 5-step progress indicator that maps conversion state to clearly labelled stages, with the Agent 2 validation badge showing issue count or pass status.

## **Context**

Reads from useConversionStream state. This component is the primary visual feedback during conversion and is the centrepiece of the demo.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| 5 stages shown | Steps: Extracting PDF | Classifying topics | Agent 1 generating | Agent 2 validating | Complete. |
| Active stage highlighted | Current stage has a blue indicator dot and the label is bold. |
| Completed stages marked | Past stages show a green check mark. |
| Validation badge | During/after step 4: shows amber "Fixed N issues" or green "All checks passed". |
| Issues expandable | Clicking the amber badge expands a list showing each issue: file, rule, fix. |
| Error state | If state.stage \=== "error", a red banner shows state.error. |

## **Tasks**

74. Create /app/components/ProgressIndicator.tsx

75. Define the 5 steps as a static array with stage keys matching ConversionState.stage values

76. Map state.stage to the active step index

77. Render validation badge conditionally when state.validationIssues.length \> 0 or state.validationPassed \=== true

78. Implement expandable issues list with a toggle

79. Show each issue as: file (mono) | rule name | fix description

## **Notes**

| *The validation issues list is the most impressive UI element for judges. Make it clearly visible — not hidden behind a tiny toggle. Show it expanded by default when issuesFixed \> 0\.* |
| :---- |

# **PRD-12 — Monaco XML editor with file tabs**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 25 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Implement the Monaco editor that streams Agent 1 XML output live during generation, then populates file tabs with the final validated files from Agent 2\.

## **Context**

Uses @monaco-editor/react. The live streaming (xmlBuffer) and the final tabbed view (files) are two distinct display modes driven by conversion state.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Monaco renders | Editor is visible with language="xml" and a dark theme. |
| Live streaming | During state.stage \=== "generating", state.xmlBuffer is set as Monaco value in real time. |
| File tabs appear | After state.files is populated, tabs appear for each filename (c\_\*.dita, t\_\*.dita, r\_\*.dita, \*.ditamap). |
| Tab switching | Clicking a tab shows that file's content in the editor. |
| Ditamap tab last | The .ditamap tab is always the rightmost tab. |
| Syntax highlighting | XML keywords, tags, and attributes are syntax-highlighted. |
| Read-only | The editor is readOnly={true} — judges should not accidentally edit the output. |

## **Tasks**

80. Create /app/components/XmlEditor.tsx

81. Lazy-import Monaco: const MonacoEditor \= dynamic(() \=\> import("@monaco-editor/react"), { ssr: false })

82. When state.stage \=== "generating" and state.files is empty, pass state.xmlBuffer as value

83. When state.files is populated, show file tabs and pass selectedFile content as value

84. Sort tabs: concept files first, then task, then reference, then ditamap

85. Set options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}

## **Notes**

| *Monaco must be dynamically imported with ssr: false — it uses browser APIs and will crash on SSR. The dynamic import adds \~200ms first-render latency which is acceptable.* |
| :---- |

# **PRD-13 — Download button and job history table**

| Priority | P1 |
| :---- | :---- |
| **Estimated effort** | 20 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Implement the ZIP download button that appears after conversion completes, and a job history table below the main UI showing past conversions from Supabase with status badges.

## **Context**

The history table is a strong demo asset — it makes the tool feel like a real product rather than a one-shot prototype. It uses Supabase realtime subscription for live updates.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Download button appears | When state.stage \=== "done", a "Download DITA ZIP" button is visible. |
| Download works | Clicking the button opens state.outputUrl in a new tab, triggering a ZIP download. |
| History table renders | A table below the main UI shows all jobs ordered by created\_at DESC. |
| Columns | Columns: Filename | Created | Status | Actions (Download link if done). |
| Status badges | Each status value has a distinct badge colour: done=green, error=red, generating=blue, others=gray. |
| Live updates | When a new conversion completes, the table row updates without page refresh via Supabase realtime. |

## **Tasks**

86. Create /app/components/DownloadButton.tsx — renders only when state.outputUrl is set

87. Create /app/components/JobHistory.tsx

88. On mount, fetch all jobs: supabase.from("jobs").select("\*").order("created\_at", { ascending: false })

89. Subscribe to realtime: supabase.channel("jobs").on("postgres\_changes", ...).subscribe()

90. On INSERT or UPDATE event, update the jobs array in state

91. Unsubscribe in useEffect cleanup

## **Notes**

| *Realtime subscription requires the jobs table to have replication enabled (done in PRD-02). If realtime is not working, poll every 3 seconds as a fallback.* |
| :---- |

# **PRD-14 — Main page layout and BNY branding**

| Priority | P1 |
| :---- | :---- |
| **Estimated effort** | 20 min |
| **Phase** | 3 of 5 |
| **Owner** | Frontend dev |

## **Summary**

Assemble all components into the main page layout with BNY-aligned branding: navy header, BNY logo, clean sans-serif typography, and a two-column layout for the progress indicator and Monaco editor.

## **Context**

Judges are from BNY. Matching their brand palette signals attention to detail. Spend 20 minutes maximum on this — functional correctness is more important than design polish.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Navy header | Header background is \#0C2340 (BNY navy). White text. BNY or hackathon title shown. |
| Two-column layout | Left column (40%): UploadZone \+ ProgressIndicator. Right column (60%): XmlEditor. |
| Responsive | On screens below 768px, columns stack vertically. |
| JobHistory below | Job history table is below the two-column section, full width. |
| Clean typography | Body font is Inter or system-ui. No Comic Sans, no decorative fonts. |
| Page title | \<title\> is "DITA Converter — BNY Hackathon 2026". |

## **Tasks**

92. Edit /app/page.tsx to assemble UploadZone, ProgressIndicator, XmlEditor, DownloadButton, JobHistory

93. Create /app/components/Header.tsx with navy background and title

94. Use Tailwind grid: grid-cols-1 md:grid-cols-5 for layout

95. Left col: md:col-span-2. Right col: md:col-span-3.

96. Pass useConversionStream state down to all components as props

97. Set document title in /app/layout.tsx

## **Notes**

| *BNY colour reference: Navy \#0C2340, Blue \#185FA5, Light blue \#E6F1FB. Do not spend more than 20 minutes on styling — a functional ugly tool beats a beautiful broken one.* |
| :---- |

# **PRD-15 — Vercel deployment and end-to-end test**

| Priority | P0 |
| :---- | :---- |
| **Estimated effort** | 30 min |
| **Phase** | 4 of 5 |
| **Owner** | Full-stack dev |

## **Summary**

Deploy the application to Vercel, configure all environment variables in the Vercel dashboard, run an end-to-end conversion of the sample PDF, and verify all acceptance criteria pass on the live URL.

## **Context**

Must be the final step. Run this at least 30 minutes before the demo to allow time to fix deployment issues. The live Vercel URL is what you show judges — not localhost.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Deployed | vercel \--prod exits with a live URL (https://dita-converter-xxx.vercel.app or custom domain). |
| Env vars set | GEMINI\_API\_KEY, NEXT\_PUBLIC\_SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY are set in Vercel → Settings → Environment Variables for Production. |
| Sample PDF converts | Uploading Sample\_File\_\_Manage\_2a-7\_Processing.pdf on the live URL completes without error. |
| All 5 stages complete | The progress indicator shows all 5 stages as green/done. |
| Monaco shows 4 files | 3 .dita file tabs \+ 1 .ditamap tab are populated with XML content. |
| Agent 2 report visible | Validation badge shows either "All checks passed" or "Fixed N issues". |
| ZIP downloads | Clicking Download DITA ZIP downloads a .zip containing the DITA files. |
| ZIP contents valid | Unzipping locally shows correctly named .dita files and .ditamap with valid XML structure. |

## **Tasks**

98. Run: vercel \--prod from the project root

99. In Vercel dashboard → Settings → Environment Variables: add GEMINI\_API\_KEY, NEXT\_PUBLIC\_SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY

100. Trigger a new deployment after adding env vars (or redeploy)

101. Open the live URL and upload the sample PDF

102. Verify all 5 stages complete and the Monaco editor shows 4 file tabs

103. Download the ZIP and verify it contains 4 files with correct XML

104. If any stage fails, check Vercel → Functions → Logs for the error

105. Rehearse the demo script 3 times using the live URL

## **Notes**

| *If DITA-OT validation is not available on Vercel (Java process), demonstrate validation using the live Agent 2 report in the UI instead. The Agent 2 validation panel is sufficient evidence of structural correctness for the demo.* |
| :---- |

# **Environment variables reference**

All variables must be present in .env.local for local development and in Vercel → Settings → Environment Variables → Production for deployment.

| Variable | Where to get it | Used in |
| :---- | :---- | :---- |
| GEMINI\_API\_KEY | console.cloud.google.com → APIs & Services → Credentials | /api/classify, /api/generate |
| NEXT\_PUBLIC\_SUPABASE\_URL | Supabase → Settings → API → Project URL | Frontend Supabase client |
| SUPABASE\_SERVICE\_ROLE\_KEY | Supabase → Settings → API → service\_role key (secret) | /api/generate (server only) |

| *Never expose SUPABASE\_SERVICE\_ROLE\_KEY in client-side code or NEXT\_PUBLIC\_ prefixed variables. It has full database access and bypasses RLS.* |
| :---- |

# **Demo script (3 minutes)**

## **Opening — 30 seconds**

"BNY has thousands of pages of technical documentation that need to move to DITA. Manual conversion takes weeks. We built a tool that does it in under 30 seconds — fully automated, with a two-agent AI pipeline that generates and then validates the output."

## **Live demo — 90 seconds**

| Time | Action | Say |
| :---- | :---- | :---- |
| 0:30 | Drag sample PDF onto upload zone | "Watch the pipeline — extracting structure, classifying topics…" |
| 0:45 | Progress reaches Agent 1 | "Agent 1 is generating DITA XML now. Notice the Monaco editor filling live — XML is streaming token by token." |
| 1:05 | Progress reaches Agent 2 | "Agent 2 is now validating the output against 10 DITA compliance rules." |
| 1:20 | Validation badge appears | "Three issues were found and fixed automatically — whitespace inside menucascade, a missing class attribute, and the keydef in the ditamap." |
| 1:35 | Click Download ZIP | "DITA-OT valid. Four files — three topic files and a document map." |

## **Architecture — 45 seconds**

"Three layers: Next.js frontend streams live to Monaco via SSE. Four API routes form the pipeline. Gemini 2.0 Flash runs both agents — the free tier handles our load. Supabase gives us persistent job history and realtime status updates. Deployed to Vercel — here's the live URL."

| *End 2 seconds early. Invite questions. Never run over time.* |
| :---- |
