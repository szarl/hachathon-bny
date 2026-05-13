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


