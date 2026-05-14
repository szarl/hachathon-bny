<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-08 — /api/generate route — Storage upload and completion

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

## **Implementation update — May 13, 2026**

Use [architecture-decisions.md](architecture-decisions.md) as the shared refinement layer for this PRD.

- ZIP contents should include final validated XML files and only image assets referenced by those XML files.
- Store images under `images/` inside the ZIP.
- Do not include unused extracted images in the final ZIP.
- Output upload path should be unique: `outputs/{jobId}/{timestamp}-dita_output.zip`.
- The `files` SSE event should include XML text files only.
- Add a separate `assets` event or final metadata for asset summaries; do not send base64 asset payloads over SSE.
- Update `jobs.metadata` with useful counts:
  - `topicCount`
  - `fileCount`
  - `usedAssetCount`
  - `skippedAssetCount`
  - `validationPassed`
  - `validationIssueCount`


