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


