<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-13 — Download button and job history table

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


