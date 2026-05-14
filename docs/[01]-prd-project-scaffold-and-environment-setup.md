<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-01 — Project scaffold and environment setup

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

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- The app is already scaffolded in the repo root under `src/app`.
- Use `@google/genai`, not `@google/generative-ai`.
- Add only required runtime dependencies: `@monaco-editor/react`, `jszip`, `fast-xml-parser`, and `lucide-react`.
- Runtime API code should live under `src/app/api/...`.
- Shared server helpers should live under `src/lib/...`.
- Add split model env vars with defaults in code:
  - `GEMINI_CLASSIFY_MODEL`
  - `GEMINI_GENERATE_MODEL`
  - `GEMINI_VALIDATE_MODEL`
- Add `EXTRACT_API_URL` for production extraction when the deployed Python function is not reached through the local rewrite.
- Keep secrets out of client components. The service role key is server-only.


