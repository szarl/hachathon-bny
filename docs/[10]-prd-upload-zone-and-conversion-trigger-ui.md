<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-10 — Upload zone and conversion trigger UI

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

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- UploadZone should upload exactly one PDF to `POST /api/jobs`, not directly to Supabase.
- Enforce PDF-only and 50 MB max before upload.
- Button phases before SSE:
  - `Uploading...`
  - `Starting conversion...`
- After `/api/jobs` returns `jobId`, call `startConversion({ jobId, documentTitle })`.
- Do not call `/api/extract` or `/api/classify` from the browser.
- `productName` is fixed internally as `BNY Platform`; do not add a UI field for it in the first build.


