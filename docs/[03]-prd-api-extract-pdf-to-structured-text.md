<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-03 — /api/extract route — PDF to structured text

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

14. [x] Create /app/api/extract/route.ts

15. [x] Add export const maxDuration \= 60 at the top of the file

16. [x] Implement the PYTHON\_EXTRACTOR string constant exactly as specified in two\_agent\_gemini\_pipeline.md

17. [x] Implement the POST handler: read FormData, write PDF to /tmp/{randomHex}.pdf, write Python script to /tmp/{randomHex}.py

18. [x] Run: const { stdout } \= await execAsync(\`python3 ${pyPath} ${pdfPath}\`)

19. [x] Parse stdout as JSON and return as { extractedPages }

20. [x] In a finally block, unlink both temp files with .catch(() \=\> {})

## **Code reference**

See PDF extractor implementation in api\_classify\_prompt.md, section "PDF extractor to pair with this route".

## **Notes**

| *Install pdfplumber on the machine before the hackathon: pip install pdfplumber. Verify python3 \-c "import pdfplumber; print('ok')" prints ok.* |
| :---- |

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- PDF parsing belongs to the deployed Python/Vercel extractor function, not a new TypeScript subprocess route.
- Local development can keep the existing `next.config.ts` rewrite from `/api/extract` to `http://127.0.0.1:8001/api/extract`.
- Production should use `EXTRACT_API_URL` or an equivalent Vercel route to reach the deployed Python extractor.
- The extractor response should expand from plain text pages to document structure plus assets:

```ts
type ExtractedPage = {
  pageNumber: number;
  text: string;
  fontSizes: number[];
  source?: "pdfplumber" | "ocr";
  images?: ExtractedImage[];
};

type ExtractedImage = {
  filename: string;
  pageNumber: number;
  caption?: string;
  width?: number;
  height?: number;
  dataBase64?: string;
  mimeType: "image/png" | "image/jpeg";
  skipped?: boolean;
  warning?: string;
};
```

- Image extraction should happen in Python. The first implementation should support embedded/raster PDF images and cap base64 payloads at about 2 MB per image and 10 MB total per PDF.
- OCR should be an optional fallback stage after the core text/image pipeline works. OCR output must normalize back into the same `ExtractedPage` shape.

### Completion notes — May 14, 2026

- Completed according to the May 13 architecture update: the implemented route is the deployed Python extractor in `api/extract.py`, with local Next.js development continuing to rewrite `/api/extract` to `http://127.0.0.1:8001/api/extract`.
- The older TypeScript subprocess checklist items above are marked done as superseded by the architecture update rather than implemented under `src/app/api/extract/route.ts`.
- The extractor now returns `source: "pdfplumber"` and `images` on each page, supports direct embedded JPEG/PNG streams plus a rendered PNG fallback, and enforces 2 MB per-image / 10 MB total base64 payload caps.


