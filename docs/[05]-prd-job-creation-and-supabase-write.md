<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-05 — Job creation and Supabase write

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


