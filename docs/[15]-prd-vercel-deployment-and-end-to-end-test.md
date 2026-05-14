<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-15 — Vercel deployment and end-to-end test

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

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- Production env vars should include:
  - `GEMINI_API_KEY`
  - `GEMINI_CLASSIFY_MODEL`
  - `GEMINI_GENERATE_MODEL`
  - `GEMINI_VALIDATE_MODEL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `EXTRACT_API_URL`
- Validate that the deployed Python extractor function supports the expanded image-aware response shape or degrades gracefully without images.
- End-to-end validation should cover:
  1. PDF upload through `/api/jobs`.
  2. `/api/generate` single SSE stream.
  3. Live Agent 1 Monaco preview.
  4. Agent 2 validation report.
  5. Final XML tabs.
  6. ZIP download from public Supabase Storage.
  7. ZIP contains XML and only referenced images under `images/`.
- If OCR fallback is not enabled yet, test that sparse/scanned PDFs produce a clear message rather than a confusing pipeline failure.


