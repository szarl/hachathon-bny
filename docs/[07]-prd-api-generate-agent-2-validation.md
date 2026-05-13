<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-07 — /api/generate route — Agent 2 validation

## **Summary**

Extend the /api/generate route to run Agent 2 after Agent 1 completes. Agent 2 validates and repairs the generated DITA XML, returns a structured JSON report, and the corrected files are used for all downstream steps.

## **Context**

Implemented inside the same route file as PRD-06. Agent 2 runs after agent1\_done is sent. It uses responseMimeType: "application/json" to force structured output.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Stage event sent | data: {"type":"stage","stage":"validating","label":"Agent 2 — validating XML"} is sent before Agent 2 call. |
| Validation event sent | data: {"type":"validation","passed":bool,"issueCount":N,"issues":\[...\]} is sent after Agent 2 returns. |
| responseMimeType set | Agent 2 model is created with generationConfig: { responseMimeType: "application/json" }. |
| JSON parsed cleanly | ValidationResult is parsed from Agent 2 response with no thrown errors for the sample PDF. |
| Repaired files used | The final files sent in the done event come from validation.files, not agent1Files. |
| 10 validation rules checked | AGENT\_2\_SYSTEM prompt contains all 10 rules: XML\_WELL\_FORMED through MAP\_COMPLETENESS. |

## **Tasks**

44. Copy AGENT\_2\_SYSTEM prompt from two\_agent\_gemini\_pipeline.md verbatim

45. Implement runAgent2(files) using model.generateContent() (not streaming)

46. Set generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }

47. Add 2-second delay before Agent 2 call: await new Promise(r \=\> setTimeout(r, 2000))

48. Parse the JSON response into ValidationResult interface

49. Add fence-stripping fallback: raw.replace(/^\`\`\`(?:json)?\\s\*/m, "").replace(/\\s\*\`\`\`$/m, "").trim()

50. Send validation SSE event with passed, issueCount, issues array

51. Use validation.files (not agent1Files) for all subsequent steps

## **Code reference**

Full implementation in two\_agent\_gemini\_pipeline.md, section "Agent 2: validator".

## **Notes**

| *The 2-second delay between Agent 1 and Agent 2 prevents 429 rate limit errors on the Gemini free tier (15 RPM). Do not remove it.* |
| :---- |


