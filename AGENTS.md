<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DITA Converter Implementation Notes

This repo is for the AI in Finance Hackathon 2026 DITA Conversion Tool. The source requirements pack is `docs/DITA_Converter_PRD_Pack.docx.md`; it has also been split into one descriptive file per PRD:

- `docs/[01]-prd-project-scaffold-and-environment-setup.md`
- `docs/[02]-prd-supabase-database-and-storage-setup.md`
- `docs/[03]-prd-api-extract-pdf-to-structured-text.md`
- `docs/[04]-prd-api-classify-topic-classification.md`
- `docs/[05]-prd-job-creation-and-supabase-write.md`
- `docs/[06]-prd-api-generate-agent-1-dita-generation.md`
- `docs/[07]-prd-api-generate-agent-2-validation.md`
- `docs/[08]-prd-api-generate-storage-upload-and-completion.md`
- `docs/[09]-prd-use-conversion-stream-hook.md`
- `docs/[10]-prd-upload-zone-and-conversion-trigger-ui.md`
- `docs/[11]-prd-five-stage-progress-indicator.md`
- `docs/[12]-prd-monaco-xml-editor-with-file-tabs.md`
- `docs/[13]-prd-download-button-and-job-history-table.md`
- `docs/[14]-prd-main-page-layout-and-bny-branding.md`
- `docs/[15]-prd-vercel-deployment-and-end-to-end-test.md`

Work through the PRDs in order. `PRD-01` and `PRD-02` can run in parallel; backend pipeline work is `PRD-03` through `PRD-08`; frontend work is `PRD-09` through `PRD-14`; deployment and final E2E validation is `PRD-15`.

Current project state:

- Next.js app is already scaffolded in the repo root with TypeScript, App Router, Tailwind, and ESLint.
- Package name is `hachathon-bny`.
- Installed AI SDK is `@google/genai`, not the older `@google/generative-ai` package mentioned in parts of the PRD pack.
- Installed Supabase SDK is `@supabase/supabase-js`.
- `.env.example` currently includes Gemini and Supabase placeholders. Keep secrets out of Git.

Implementation cautions:

- Server-only Supabase code must use the service role key and must never expose it through `NEXT_PUBLIC_*` variables or client components.
- Client Supabase code should use public URL plus publishable/anon key only.
- `pdfplumber` is a Python package, not an npm package. The extractor route should invoke Python from the server runtime as described in `PRD-03`.
- Python PDF extraction lives in `api/extract.py` with dependencies in `requirements.txt`. For local development, run `npm run dev:extract` in one terminal and `npm run dev` in another; `next.config.ts` rewrites `/api/extract` to the local Python server on port 8001.
- Monaco must be dynamically imported with SSR disabled.
- `/api/generate` is expected to stream Server-Sent Events and run Agent 1 followed by Agent 2 in the same request.
- The PRD pack references support files such as `two_agent_gemini_pipeline.md` and `api_classify_prompt.md`; verify whether they exist before implementing prompt-heavy routes.
