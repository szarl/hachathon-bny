<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-09 — useConversionStream React hook

## **Summary**

Implement the useConversionStream hook that consumes the SSE stream from /api/generate and maps every event type to typed React state. This hook is the single source of truth for all UI state during conversion.

## **Context**

All frontend components (progress indicator, Monaco editor, validation panel, download button) read from this hook's state. It must be implemented before any UI components.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Hook exists | /app/hooks/useConversionStream.ts exports useConversionStream(). |
| State shape | Hook returns { state: ConversionState, startConversion }. ConversionState matches the interface in two\_agent\_gemini\_pipeline.md exactly. |
| token events | Each token event appends event.text to state.xmlBuffer. |
| stage events | state.stage and state.stageLabel update on each stage event. |
| validation events | state.validationPassed, validationIssues, and issuesFixed update correctly. |
| files events | state.files is populated with the full Record\<string, string\> on the files event. |
| done events | state.stage becomes "done" and state.outputUrl is set. |
| error events | state.stage becomes "error" and state.error is set. |
| SSE chunk splitting | Multi-event chunks (multiple data: lines in one read) are split on newlines and each parsed individually. |

## **Tasks**

61. Create /app/hooks/useConversionStream.ts

62. Define Stage type and ConversionState interface exactly as in two\_agent\_gemini\_pipeline.md

63. Define INITIAL\_STATE constant

64. Implement startConversion(payload) using fetch \+ res.body.getReader()

65. In the read loop, split each chunk on "\\n", filter for lines starting with "data: ", parse JSON

66. Implement handleEvent(event) with a switch on event.type covering all 7 event types

67. Use setState with functional updater (setState(prev \=\> ...)) for all state changes

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "React hook — useConversionStream.ts".

## **Notes**

| *Use try-catch inside the line parsing loop — partial SSE chunks arrive mid-JSON and will throw. Swallow the error and let the next read deliver the complete event.* |
| :---- |


